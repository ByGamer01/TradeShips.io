/**
 * Minimal QR code encoder (ISO/IEC 18004), self-contained so the client keeps
 * zero new runtime dependencies.
 *
 * Scope (all an invite link needs):
 * - Byte mode only, ECC level M, versions 1-10 (up to 213 bytes of payload).
 * - Fixed mask pattern 0 — spec-valid; mask evaluation only optimizes scans.
 */

const MIN_VERSION = 1;
const MAX_VERSION = 10;

// ECC level M tables, indexed by version - 1.
const TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const ECC_CODEWORDS_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_ECC_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

// Alignment pattern center coordinates (spec Annex E), indexed by version - 1.
const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 52],
];

const MASK_PATTERN = 0; // (x + y) % 2 === 0
const FORMAT_ECC_M = 0b00;

/** true = dark module. Row-major: matrix[y][x]. */
export type QrMatrix = boolean[][];

export function encodeQr(text: string): QrMatrix {
  const data = new TextEncoder().encode(text);
  const version = chooseVersion(data.length);
  const size = version * 4 + 17;

  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  drawFunctionPatterns(version, size, set);
  const codewords = buildCodewords(data, version);
  drawCodewords(codewords, size, modules, isFunction);
  applyMask(size, modules, isFunction);
  return modules;
}

/** Render a QR matrix as a standalone SVG string with a 4-module quiet zone. */
export function qrToSvg(text: string): string {
  const matrix = encodeQr(text);
  const size = matrix.length;
  const quiet = 4;
  const dimension = size + quiet * 2;
  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) {
        parts.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges">` +
    `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>` +
    `<path d="${parts.join("")}" fill="#000000"/>` +
    `</svg>`
  );
}

function chooseVersion(byteLength: number): number {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    const capacityBits = TOTAL_CODEWORDS[version - 1] * 8 - eccBits(version);
    const neededBits = 4 + countBits(version) + byteLength * 8;
    if (neededBits <= capacityBits) {
      return version;
    }
  }
  throw new Error(`QR payload too long: ${byteLength} bytes`);
}

function eccBits(version: number): number {
  return (
    ECC_CODEWORDS_PER_BLOCK[version - 1] * NUM_ECC_BLOCKS[version - 1] * 8
  );
}

function countBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

//
// Bit stream + codewords
//

function buildCodewords(data: Uint8Array, version: number): Uint8Array {
  const dataCodewords =
    TOTAL_CODEWORDS[version - 1] -
    ECC_CODEWORDS_PER_BLOCK[version - 1] * NUM_ECC_BLOCKS[version - 1];

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, data.length, countBits(version));
  for (const b of data) {
    appendBits(bits, b, 8);
  }

  const capacityBits = dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length)); // terminator
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8); // byte align
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(bits, pad, 8);
  }

  const dataBytes = new Uint8Array(dataCodewords);
  bits.forEach((bit, i) => {
    dataBytes[i >>> 3] |= bit << (7 - (i & 7));
  });

  return interleaveBlocks(dataBytes, version);
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) {
    bits.push((value >>> i) & 1);
  }
}

/** Split data into EC blocks, compute ECC per block, and interleave. */
function interleaveBlocks(data: Uint8Array, version: number): Uint8Array {
  const numBlocks = NUM_ECC_BLOCKS[version - 1];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[version - 1];
  const rawCodewords = TOTAL_CODEWORDS[version - 1];
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockDataLen =
    Math.floor(rawCodewords / numBlocks) - blockEccLen;

  const blocks: { data: Uint8Array; ecc: Uint8Array }[] = [];
  const divisor = rsComputeDivisor(blockEccLen);
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortBlockDataLen + (i < numShortBlocks ? 0 : 1);
    const blockData = data.slice(offset, offset + len);
    offset += len;
    blocks.push({
      data: blockData,
      ecc: rsComputeRemainder(blockData, divisor),
    });
  }

  const result = new Uint8Array(rawCodewords);
  let k = 0;
  const maxDataLen = shortBlockDataLen + 1;
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.data.length) {
        result[k++] = block.data[i];
      }
    }
  }
  for (let i = 0; i < blockEccLen; i++) {
    for (const block of blocks) {
      result[k++] = block.ecc[i];
    }
  }
  return result;
}

//
// Reed-Solomon over GF(2^8), reducing polynomial 0x11D
//

export function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** Coefficients of the RS generator polynomial (leading 1 omitted). */
export function rsComputeDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  // Multiply (x - α^0)(x - α^1)...(x - α^(degree-1)).
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) {
        result[j] ^= result[j + 1];
      }
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

export function rsComputeRemainder(
  data: Uint8Array,
  divisor: Uint8Array,
): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

//
// Function patterns
//

type SetModule = (x: number, y: number, dark: boolean) => void;

function drawFunctionPatterns(
  version: number,
  size: number,
  set: SetModule,
): void {
  // Timing patterns.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Finder patterns with separators (corners).
  drawFinderPattern(3, 3, size, set);
  drawFinderPattern(size - 4, 3, size, set);
  drawFinderPattern(3, size - 4, size, set);

  // Alignment patterns (skip the three overlapping the finders).
  const positions = ALIGNMENT_POSITIONS[version - 1];
  const last = positions.length - 1;
  positions.forEach((cy, i) => {
    positions.forEach((cx, j) => {
      const overlapsFinder =
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0);
      if (!overlapsFinder) {
        drawAlignmentPattern(cx, cy, set);
      }
    });
  });

  drawFormatBits(size, set);
  if (version >= 7) {
    drawVersionBits(version, size, set);
  }
}

function drawFinderPattern(
  cx: number,
  cy: number,
  size: number,
  set: SetModule,
): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignmentPattern(cx: number, cy: number, set: SetModule): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

/** 15-bit format info for ECC level M + mask 0, in both required copies. */
export function formatBits(): number {
  const data = (FORMAT_ECC_M << 3) | MASK_PATTERN;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

function drawFormatBits(size: number, set: SetModule): void {
  const bits = formatBits();
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;

  // First copy, around the top-left finder.
  for (let i = 0; i <= 5; i++) {
    set(8, i, bit(i));
  }
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) {
    set(14 - i, 8, bit(i));
  }

  // Second copy, split between top-right and bottom-left.
  for (let i = 0; i <= 7; i++) {
    set(size - 1 - i, 8, bit(i));
  }
  for (let i = 8; i < 15; i++) {
    set(8, size - 15 + i, bit(i));
  }
  set(8, size - 8, true); // dark module
}

function drawVersionBits(version: number, size: number, set: SetModule): void {
  // 18-bit version info: 6 data bits + 12-bit BCH remainder.
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    set(a, b, dark);
    set(b, a, dark);
  }
}

//
// Codeword placement + masking
//

function drawCodewords(
  codewords: Uint8Array,
  size: number,
  modules: boolean[][],
  isFunction: boolean[][],
): void {
  let i = 0; // bit index into codewords
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < codewords.length * 8) {
          modules[y][x] =
            ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
        // Remaining modules stay light (spec: remainder bits are 0).
      }
    }
  }
}

function applyMask(
  size: number,
  modules: boolean[][],
  isFunction: boolean[][],
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && (x + y) % 2 === 0) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
}

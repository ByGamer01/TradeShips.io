import { describe, expect, it } from "vitest";
import {
  encodeQr,
  formatBits,
  gfMultiply,
  qrToSvg,
  rsComputeDivisor,
  rsComputeRemainder,
} from "../src/client/utilities/QrCode";

// GF(256) exponentiation: α = 0x02.
function gfPow(exponent: number): number {
  let result = 1;
  for (let i = 0; i < exponent; i++) {
    result = gfMultiply(result, 0x02);
  }
  return result;
}

// Evaluate the codeword polynomial at x using Horner's method.
function polyEval(codeword: number[], x: number): number {
  let acc = 0;
  for (const coefficient of codeword) {
    acc = gfMultiply(acc, x) ^ coefficient;
  }
  return acc;
}

describe("Reed-Solomon encoding", () => {
  it.each([7, 10, 16, 18, 22, 24, 26])(
    "produces codewords with zero syndromes (degree %i)",
    (degree) => {
      const data = Uint8Array.from(
        { length: 30 },
        (_, i) => (i * 37 + 11) & 0xff,
      );
      const divisor = rsComputeDivisor(degree);
      const ecc = rsComputeRemainder(data, divisor);
      const codeword = [...data, ...ecc];

      // A valid RS codeword evaluates to zero at every generator root α^i.
      for (let i = 0; i < degree; i++) {
        expect(polyEval(codeword, gfPow(i))).toBe(0);
      }
    },
  );

  it("computes ECC for the empty message as all zeros", () => {
    const divisor = rsComputeDivisor(10);
    const ecc = rsComputeRemainder(new Uint8Array(0), divisor);
    expect([...ecc]).toEqual(new Array(10).fill(0));
  });
});

describe("format information", () => {
  it("matches the spec constant for ECC level M with mask 0", () => {
    // Data bits 00000 (M=00, mask=000) have a zero BCH remainder, so the
    // final format value is exactly the 0x5412 XOR mask from the spec.
    expect(formatBits()).toBe(0x5412);
  });
});

describe("encodeQr matrix", () => {
  const FINDER_ROW = [true, true, true, true, true, true, true];

  it.each([
    ["short", "tradeships.io", 21], // version 1
    ["site", "https://tradeships.io/", 25], // version 2
    [
      "lobby",
      "https://tradeships.io/w0/game/a1b2c3d4?lobby&s=x1y2z&ref=qr",
      33, // version 4
    ],
    [
      "long",
      "https://tradeships.io/w1/game/a1b2c3d4?lobby&s=x1y2z&ref=party&extra=".padEnd(
        140,
        "x",
      ),
      49, // version 8 — exercises the version-info blocks (v >= 7)
    ],
  ])("produces a well-formed matrix (%s)", (_label, text, expectedSize) => {
    const matrix = encodeQr(text);

    expect(matrix.length).toBe(expectedSize);
    for (const row of matrix) {
      expect(row.length).toBe(expectedSize);
    }

    const size = matrix.length;

    // Finder patterns: solid 7-wide dark border rows at the three corners.
    expect(matrix[0].slice(0, 7)).toEqual(FINDER_ROW);
    expect(matrix[0].slice(size - 7)).toEqual(FINDER_ROW);
    expect(matrix[size - 7].slice(0, 7)).toEqual(FINDER_ROW);

    // Separators are light.
    expect(matrix[7].slice(0, 8).some(Boolean)).toBe(false);

    // Timing pattern alternates between the finders.
    for (let i = 8; i < size - 8; i++) {
      expect(matrix[6][i]).toBe(i % 2 === 0);
      expect(matrix[i][6]).toBe(i % 2 === 0);
    }

    // Dark module.
    expect(matrix[size - 8][8]).toBe(true);
  });

  it("stores the format bits in the second copy positions", () => {
    const matrix = encodeQr("tradeships.io");
    const size = matrix.length;
    const expected = formatBits();
    // Bits 0..7 run right-to-left along row 8 from the right edge.
    for (let i = 0; i <= 7; i++) {
      expect(matrix[8][size - 1 - i]).toBe(((expected >>> i) & 1) !== 0);
    }
    // Bits 8..14 run top-to-bottom along column 8 near the bottom edge.
    for (let i = 8; i < 15; i++) {
      expect(matrix[size - 15 + i][8]).toBe(((expected >>> i) & 1) !== 0);
    }
  });

  it("round-trips the payload through the matrix (version 1, single block)", () => {
    const text = "tradeships.io";
    const matrix = encodeQr(text);
    const size = matrix.length;

    // Rebuild the function-module map the same way the encoder lays it out:
    // everything outside the zigzag data region for version 1.
    const isFunction = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    );
    const markRect = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          isFunction[y][x] = true;
        }
      }
    };
    markRect(0, 0, 9, 9); // top-left finder + separator + format
    markRect(size - 8, 0, 8, 9); // top-right finder + format
    markRect(0, size - 8, 9, 8); // bottom-left finder + format + dark module
    for (let i = 0; i < size; i++) {
      isFunction[6][i] = true;
      isFunction[i][6] = true;
    }

    // Undo mask 0 and read bits in zigzag order.
    const bits: number[] = [];
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x]) {
            const unmasked = matrix[y][x] !== ((x + y) % 2 === 0);
            bits.push(unmasked ? 1 : 0);
          }
        }
      }
    }

    const readBits = (offset: number, length: number) => {
      let value = 0;
      for (let i = 0; i < length; i++) {
        value = (value << 1) | bits[offset + i];
      }
      return value;
    };

    expect(readBits(0, 4)).toBe(0b0100); // byte mode
    const length = readBits(4, 8);
    expect(length).toBe(text.length);
    const decoded = Array.from({ length }, (_, i) =>
      readBits(12 + i * 8, 8),
    );
    expect(String.fromCharCode(...decoded)).toBe(text);
  });
});

describe("qrToSvg", () => {
  it("renders a standalone SVG with a quiet zone", () => {
    const svg = qrToSvg("tradeships.io");
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 29 29"'); // 21 modules + 2x4 quiet zone
    expect(svg).toContain("<path");
  });
});

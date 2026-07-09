import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CELL = 13;
const OUT = path.join("resources", "atlases", "unit-atlas.png");

const GRAY = {
  D: 70,
  C: 100,
  M: 130,
  H: 180,
  W: 255,
};

const TRANSPARENT = ".";

const sprites = [
  {
    name: "Transport",
    rows: [
      ".............",
      ".............",
      ".............",
      ".............",
      "......D......",
      ".....DHD.....",
      "....DHHHD....",
      ".....DHD.....",
      "......D......",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Trade Ship",
    rows: [
      ".............",
      ".............",
      ".............",
      ".............",
      "......H......",
      ".....HDH.....",
      "....HDDDH....",
      ".....HDH.....",
      "......H......",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Warship",
    rows: [
      ".............",
      "......H......",
      "...HHHDHHH...",
      "..HHHDDDHHH..",
      "..HHDDDDDHH..",
      "..HDDDCDDDH..",
      ".HDDDCCCDDDH.",
      "..HDDDCDDDH..",
      "..HHDDDDDHH..",
      "..HHHDDDHHH..",
      "...HHHDHHH...",
      "......H......",
      ".............",
    ],
  },
  {
    name: "Atom Bomb",
    rows: [
      ".............",
      "......H......",
      ".....HMH.....",
      ".....MMM.....",
      "....DMMMD....",
      "....DMMMD....",
      ".....DMD.....",
      ".....D.D.....",
      "....D...D....",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Hydrogen Bomb",
    rows: [
      ".............",
      "......H......",
      ".....HHH.....",
      "....HMMMH....",
      "...HMMMMMH...",
      "..DMMMMMMMD..",
      "..DMMCCCMMDD.",
      "..DMMMMMMMD..",
      "...HMMMMMH...",
      "....HMMMH....",
      ".....DDD.....",
      ".............",
      ".............",
    ],
  },
  {
    name: "MIRV",
    rows: [
      ".............",
      "......H......",
      ".....HMH.....",
      "....HMMMH....",
      "...DMMMMMD...",
      "..DMMCCCMMD..",
      "...DMMMMMD...",
      "....DMDMD....",
      "...D..D..D...",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "SAMMissile",
    rows: [
      ".............",
      ".............",
      "......H......",
      ".....MHM.....",
      ".....MHM.....",
      "......D......",
      ".....D.D.....",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Shell",
    rows: [
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      "......H......",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Torpedo",
    rows: [
      ".............",
      ".............",
      ".............",
      "...DMMHHHD...",
      "..DMMMMHHHD..",
      ".DMMCMMCHHHD.",
      "..DMMMMHHHD..",
      "...DMMHHHD...",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Naval Mine",
    rows: [
      ".............",
      "......D......",
      "....D.H.D....",
      "...D..H..D...",
      "...DMMMMMD...",
      "..DMHHHHHMD..",
      ".DMMCCCCCMMD.",
      ".DMMCCCCCMMD.",
      "..DMHHHHHMD..",
      "..DMCCCCCMD..",
      "...DMMMMMD...",
      "....D.H.D....",
      "......D......",
    ],
  },
  {
    name: "MIRV Warhead",
    rows: [
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".....HHH.....",
      ".....HHH.....",
      ".....HHH.....",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "TrainEngine",
    rows: [
      ".............",
      ".............",
      "....HHH......",
      "....MMM......",
      "...DMMMD.....",
      "...DMMMD.....",
      "....D.D......",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "TrainCarriage",
    rows: [
      ".............",
      ".............",
      ".............",
      "...DDDDD.....",
      "...DMMMD.....",
      "...DMMMD.....",
      "....D.D......",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "TrainCarriageLoaded",
    rows: [
      ".............",
      ".............",
      "....HHH......",
      "...DHHHD.....",
      "...DMMMD.....",
      "...DMMMD.....",
      "....D.D......",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Submarine",
    rows: [
      ".............",
      "......H......",
      "......H......",
      ".....DHD.....",
      "......D......",
      "......D......",
      "....DMMMD....",
      "..DMMCCCMM...",
      ".DMMMCCCMMD..",
      "..DMMCCCMM...",
      "....DMMMD....",
      ".............",
      ".............",
    ],
  },
  {
    name: "Aircraft Carrier",
    rows: [
      ".............",
      ".............",
      "....DDDDD....",
      "..DHHHHHHHD..",
      ".DHHCMHHHHD..",
      "DHHHCMHHMMHHD",
      "DHHHCMHHMMHHD",
      ".DHHCMHHHHD..",
      "..DHHHHHHHD..",
      "...DDDDDDD...",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Aircraft",
    rows: [
      ".............",
      ".............",
      ".............",
      "......H......",
      "......M......",
      "....HMMMH....",
      "..HHMMCMMHH..",
      "....HMMMH....",
      "......M......",
      ".....HDH.....",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    name: "Anti-Air Frigate",
    rows: [
      ".............",
      "......H......",
      "....HHMHH....",
      "...HMMHMMH...",
      "..DMMMMMMMD..",
      ".DMMHCCCHMMD.",
      ".DMMHCCCHMMD.",
      "..DMMMMMMMD..",
      "...HMMHMMH...",
      "....DDHDD....",
      ".....D.D.....",
      ".............",
      ".............",
    ],
  },
];

function normalizeRow(row) {
  return row.replaceAll(" ", "");
}

function validateSprites() {
  for (const sprite of sprites) {
    if (sprite.rows.length !== CELL) {
      throw new Error(`${sprite.name}: expected ${CELL} rows`);
    }
    for (const [rowIndex, rawRow] of sprite.rows.entries()) {
      const row = normalizeRow(rawRow);
      if (row.length !== CELL) {
        throw new Error(
          `${sprite.name}: row ${rowIndex + 1} is ${row.length}px, expected ${CELL}px`,
        );
      }
      for (const char of row) {
        if (char !== TRANSPARENT && !(char in GRAY)) {
          throw new Error(`${sprite.name}: unknown pixel code "${char}"`);
        }
      }
    }
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuf = Buffer.from(type, "ascii");
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function writePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rawRow = y * (stride + 1);
    raw[rawRow] = 0;
    rgba.copy(raw, rawRow + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND"),
  ]);
}

function renderAtlas() {
  const width = sprites.length * CELL;
  const height = CELL;
  const rgba = Buffer.alloc(width * height * 4);

  for (const [spriteIndex, sprite] of sprites.entries()) {
    for (const [y, rawRow] of sprite.rows.entries()) {
      const row = normalizeRow(rawRow);
      for (let x = 0; x < CELL; x++) {
        const char = row[x];
        if (char === TRANSPARENT) continue;
        const gray = GRAY[char];
        const px = (y * width + spriteIndex * CELL + x) * 4;
        rgba[px] = gray;
        rgba[px + 1] = gray;
        rgba[px + 2] = gray;
        rgba[px + 3] = 255;
      }
    }
  }

  return writePng(width, height, rgba);
}

validateSprites();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, renderAtlas());
console.log(`Wrote ${OUT} (${sprites.length} columns × ${CELL}px)`);

import fs from "fs";
import path from "path";
import zlib from "zlib";
import {
  unitAtlasColumnForType,
  UNIT_ATLAS_CELL_SIZE,
} from "../../../../src/client/render/gl/passes/UnitPass";
import {
  UT_AIRCRAFT,
  UT_CARRIER,
  UT_NAVAL_MINE,
  UT_SUBMARINE,
  UT_TORPEDO,
} from "../../../../src/client/render/types/UnitType";

const ROOT = path.join(__dirname, "..", "..", "..", "..");

interface DecodedPng {
  width: number;
  height: number;
  rgba: Buffer;
}

function decodePng(relativePath: string): DecodedPng {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)];
    expect(filter).toBe(0);
    inflated.copy(
      rgba,
      y * stride,
      y * (stride + 1) + 1,
      y * (stride + 1) + 1 + stride,
    );
  }

  return {
    width,
    height,
    rgba,
  };
}

function rowsForColumn(atlas: DecodedPng, column: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < UNIT_ATLAS_CELL_SIZE; y++) {
    let row = "";
    for (let x = 0; x < UNIT_ATLAS_CELL_SIZE; x++) {
      const px = (y * atlas.width + column * UNIT_ATLAS_CELL_SIZE + x) * 4;
      const alpha = atlas.rgba[px + 3];
      if (alpha === 0) {
        row += ".";
        continue;
      }
      const gray = atlas.rgba[px];
      row += gray === 180 ? "H" : gray === 100 ? "C" : "D";
    }
    rows.push(row);
  }
  return rows;
}

describe("unit atlas asset", () => {
  test("contains dedicated generated columns for every naval unit", () => {
    const size = decodePng("resources/atlases/unit-atlas.png");
    const lastNavalColumn =
      Math.max(
        unitAtlasColumnForType(UT_TORPEDO),
        unitAtlasColumnForType(UT_NAVAL_MINE),
        unitAtlasColumnForType(UT_SUBMARINE),
        unitAtlasColumnForType(UT_CARRIER),
        unitAtlasColumnForType(UT_AIRCRAFT),
      ) + 1;

    expect(size.height).toBe(UNIT_ATLAS_CELL_SIZE);
    expect(size.width).toBeGreaterThanOrEqual(
      lastNavalColumn * UNIT_ATLAS_CELL_SIZE,
    );
  });

  test("naval sprites have production-grade readable silhouettes", () => {
    const atlas = decodePng("resources/atlases/unit-atlas.png");
    const sampleColumn = (unitType: string) => {
      const col = unitAtlasColumnForType(unitType);
      const bands = new Set<number>();
      let opaquePixels = 0;
      for (let y = 0; y < UNIT_ATLAS_CELL_SIZE; y++) {
        for (let x = 0; x < UNIT_ATLAS_CELL_SIZE; x++) {
          const px =
            (y * atlas.width + col * UNIT_ATLAS_CELL_SIZE + x) * 4;
          if (atlas.rgba[px + 3] === 0) continue;
          opaquePixels++;
          bands.add(atlas.rgba[px]);
        }
      }
      return { bands: [...bands].sort((a, b) => a - b), opaquePixels };
    };

    expect(sampleColumn(UT_TORPEDO)).toEqual({
      bands: [70, 100, 130, 180],
      opaquePixels: expect.any(Number),
    });
    expect(sampleColumn(UT_TORPEDO).opaquePixels).toBeGreaterThanOrEqual(34);

    expect(sampleColumn(UT_NAVAL_MINE)).toEqual({
      bands: [70, 100, 130, 180],
      opaquePixels: expect.any(Number),
    });
    expect(sampleColumn(UT_NAVAL_MINE).opaquePixels).toBeGreaterThanOrEqual(64);

    expect(sampleColumn(UT_SUBMARINE)).toEqual({
      bands: [70, 100, 130, 180],
      opaquePixels: expect.any(Number),
    });
    expect(sampleColumn(UT_SUBMARINE).opaquePixels).toBeGreaterThanOrEqual(30);

    expect(sampleColumn(UT_CARRIER)).toEqual({
      bands: [70, 100, 130, 180],
      opaquePixels: expect.any(Number),
    });
    expect(sampleColumn(UT_CARRIER).opaquePixels).toBeGreaterThanOrEqual(45);

    expect(sampleColumn(UT_AIRCRAFT)).toEqual({
      bands: [70, 100, 130, 180],
      opaquePixels: expect.any(Number),
    });
    expect(sampleColumn(UT_AIRCRAFT).opaquePixels).toBeGreaterThanOrEqual(18);
  });

  test("preserves the original OpenFront transport, trade, and warship sprites", () => {
    const atlas = decodePng("resources/atlases/unit-atlas.png");

    expect(rowsForColumn(atlas, 0)).toEqual([
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
    ]);
    expect(rowsForColumn(atlas, 1)).toEqual([
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
    ]);
    expect(rowsForColumn(atlas, 2)).toEqual([
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
    ]);
  });
});

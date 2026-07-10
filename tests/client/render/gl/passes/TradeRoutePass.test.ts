import { describe, expect, it } from "vitest";
import { resolveTradeRouteColor } from "../../../../../src/client/render/gl/passes/TradeRoutePass";
import type { RenderSettings } from "../../../../../src/client/render/gl/RenderSettings";
import type { TradeRouteData } from "../../../../../src/client/render/types";

const settings: RenderSettings["tradeRoute"] = {
  lineWidth: 1.75,
  dashLen: 6,
  gapLen: 5,
  flowSpeed: 10,
  endFade: 8,
  ownR: 1,
  ownG: 0.84,
  ownB: 0.35,
  ownAlpha: 0.55,
  friendlyR: 0.35,
  friendlyG: 0.8,
  friendlyB: 0.75,
  friendlyAlpha: 0.4,
  foreignR: 0.85,
  foreignG: 0.85,
  foreignB: 0.8,
  foreignAlpha: 0.18,
  contestedR: 1,
  contestedG: 0.55,
  contestedB: 0.2,
  contestedBlend: 0.6,
  dangerousR: 1,
  dangerousG: 0.25,
  dangerousB: 0.2,
  dangerousBlend: 0.85,
};

const PALETTE_SIZE = 4096;

function paletteWith(
  ownerID: number,
  r: number,
  g: number,
  b: number,
): Float32Array {
  const data = new Float32Array(PALETTE_SIZE * 2 * 4);
  const off = ownerID * 4;
  data[off] = r;
  data[off + 1] = g;
  data[off + 2] = b;
  data[off + 3] = 150 / 255;
  return data;
}

function route(overrides: Partial<TradeRouteData> = {}): TradeRouteData {
  return {
    shipId: 1,
    ownerID: 1,
    from: 0,
    to: 1,
    distanceTiles: 1,
    enemyThreats: 0,
    escortCount: 0,
    relation: "own",
    riskLevel: "safe",
    ...overrides,
  };
}

describe("resolveTradeRouteColor", () => {
  it("does not use the owner's player color for sea lanes", () => {
    const palette = paletteWith(3, 0.2, 0.6, 0.9);
    const [r, g, b, a] = resolveTradeRouteColor(
      route({ ownerID: 3, relation: "foreign" }),
      palette,
      settings,
    );
    expect([r, g, b]).toEqual([
      settings.foreignR,
      settings.foreignG,
      settings.foreignB,
    ]);
    expect(a).toBeCloseTo(settings.foreignAlpha * 0.9);
  });

  it("keeps own routes neutral instead of making player-colored strips", () => {
    const palette = paletteWith(1, 0.5, 0.5, 0.5);
    const [r, g, b, a] = resolveTradeRouteColor(
      route({ ownerID: 1, relation: "own" }),
      palette,
      settings,
    );
    expect([r, g, b]).toEqual([
      settings.foreignR,
      settings.foreignG,
      settings.foreignB,
    ]);
    expect(a).toBeCloseTo(settings.foreignAlpha * 0.9);
  });

  it("falls back to a flat gray when the lane has no owner (neutral)", () => {
    const [r, g, b, a] = resolveTradeRouteColor(
      route({ ownerID: 0, relation: "neutral" }),
      null,
      settings,
    );
    expect([r, g, b]).toEqual([
      settings.foreignR,
      settings.foreignG,
      settings.foreignB,
    ]);
    expect(a).toBeCloseTo(settings.foreignAlpha * 0.65);
  });

  it("renders generated system ocean lanes with stronger opacity", () => {
    const [, , , a] = resolveTradeRouteColor(
      route({ shipId: -1, ownerID: 0, relation: "neutral" }),
      null,
      settings,
    );

    expect(a).toBeGreaterThan(settings.foreignAlpha);
  });

  it("falls back to a flat gray when no palette data has been pushed yet", () => {
    const [r, g, b] = resolveTradeRouteColor(
      route({ ownerID: 5 }),
      null,
      settings,
    );
    expect([r, g, b]).toEqual([
      settings.foreignR,
      settings.foreignG,
      settings.foreignB,
    ]);
  });

  it("blends toward the contested warning tint on top of the neutral lane color", () => {
    const palette = paletteWith(2, 0, 0, 0);
    const [r, g, b] = resolveTradeRouteColor(
      route({ ownerID: 2, riskLevel: "contested" }),
      palette,
      settings,
    );
    expect(r).toBeCloseTo(
      settings.foreignR +
        (settings.contestedR - settings.foreignR) * settings.contestedBlend,
    );
    expect(g).toBeCloseTo(
      settings.foreignG +
        (settings.contestedG - settings.foreignG) * settings.contestedBlend,
    );
    expect(b).toBeCloseTo(
      settings.foreignB +
        (settings.contestedB - settings.foreignB) * settings.contestedBlend,
    );
  });

  it("blends toward the dangerous warning tint on top of the neutral lane color", () => {
    const palette = paletteWith(4, 0, 0, 0);
    const [r, g, b] = resolveTradeRouteColor(
      route({ ownerID: 4, riskLevel: "dangerous" }),
      palette,
      settings,
    );
    expect(r).toBeCloseTo(
      settings.foreignR +
        (settings.dangerousR - settings.foreignR) * settings.dangerousBlend,
    );
    expect(g).toBeCloseTo(
      settings.foreignG +
        (settings.dangerousG - settings.foreignG) * settings.dangerousBlend,
    );
    expect(b).toBeCloseTo(
      settings.foreignB +
        (settings.dangerousB - settings.foreignB) * settings.dangerousBlend,
    );
  });
});

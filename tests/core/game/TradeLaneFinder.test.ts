import { describe, expect, it } from "vitest";
import { findTradeLane } from "../../../src/core/game/TradeLaneFinder";
import { setup } from "../../util/Setup";

describe("findTradeLane", () => {
  it("finds a corridor through the ocean on a maritime map", async () => {
    const game = await setup("half_land_half_ocean");

    const lane = findTradeLane(game, game.miniMap());

    expect(lane).not.toBeNull();
    expect(lane!.path.length).toBeGreaterThan(1);
    expect(lane!.halfWidth).toBeGreaterThanOrEqual(8);
  });

  it("leaves open water outside the corridor on a large map", async () => {
    const game = await setup("world");

    const lane = findTradeLane(game, game.miniMap());

    expect(lane).not.toBeNull();
    const numTiles = game.width() * game.height();
    let outsideWater = 0;
    for (let tile = 0; tile < numTiles; tile++) {
      if (game.isWater(tile) && lane!.membership[tile] === 0) outsideWater++;
    }
    expect(outsideWater).toBeGreaterThan(0);
  });

  it("is deterministic: two runs produce the identical lane", async () => {
    const game = await setup("half_land_half_ocean");

    const first = findTradeLane(game, game.miniMap());
    const second = findTradeLane(game, game.miniMap());

    expect(first).not.toBeNull();
    expect(second!.path).toEqual(first!.path);
    expect(second!.halfWidth).toBe(first!.halfWidth);
    expect(Buffer.from(second!.membership)).toEqual(
      Buffer.from(first!.membership),
    );
  });

  it("places the whole spine and membership mask on water", async () => {
    const game = await setup("half_land_half_ocean");

    const lane = findTradeLane(game, game.miniMap())!;

    for (const tile of lane.path) {
      expect(game.isWater(tile)).toBe(true);
      expect(lane.membership[tile]).toBe(1);
    }
    const numTiles = game.width() * game.height();
    for (let tile = 0; tile < numTiles; tile++) {
      if (lane.membership[tile] === 1) {
        expect(game.isWater(tile)).toBe(true);
      }
    }
  });

  it("keeps corridor endpoints away from the map edge on a large map", async () => {
    const game = await setup("world");

    const lane = findTradeLane(game, game.miniMap())!;

    // Mini-map margin is 24 → 48 full-map tiles; allow slack for scaling.
    const margin = 40;
    for (const tile of [lane.path[0], lane.path[lane.path.length - 1]]) {
      const x = tile % game.width();
      const y = (tile - x) / game.width();
      const distToEdge = Math.min(x, y, game.width() - 1 - x, game.height() - 1 - y);
      expect(distToEdge).toBeGreaterThanOrEqual(margin);
    }
  });

  it("returns null on a map without enough water", async () => {
    const game = await setup("plains");

    expect(findTradeLane(game, game.miniMap())).toBeNull();
  });
});

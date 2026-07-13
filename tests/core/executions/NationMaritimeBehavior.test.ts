import { describe, expect, it, vi } from "vitest";
import { ConstructionExecution } from "../../../src/core/execution/ConstructionExecution";
import { MaritimeObjectiveExecution } from "../../../src/core/execution/MaritimeObjectiveExecution";
import { NationMaritimeBehavior } from "../../../src/core/execution/nation/NationMaritimeBehavior";
import { TradeLaneObjectiveExecution } from "../../../src/core/execution/TradeLaneObjectiveExecution";
import {
  Game,
  GameMode,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { TileRef } from "../../../src/core/game/GameMap";
import { PseudoRandom } from "../../../src/core/PseudoRandom";
import { setup } from "../../util/Setup";

// half_land_half_ocean is 16x16: x=0-7 land, x=8-15 ocean, coast at x=7.

function addNation(game: Game): Player {
  game.addPlayer(
    new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
  );
  const nation = game.player("nation_id");
  for (let x = 0; x < 7; x++) {
    for (let y = 0; y < 16; y++) {
      const tile = game.ref(x, y);
      if (game.map().isLand(tile) && !game.map().hasOwner(tile)) {
        nation.conquer(tile);
      }
    }
  }
  nation.buildUnit(UnitType.Port, game.ref(6, 4), {});
  nation.addGold(10_000_000_000n);
  return nation;
}

/**
 * Register a single-tile stub zone so tests control what counts as "inside";
 * on the 16x16 test map the real corridor covers the whole ocean.
 */
function registerStubZone(game: Game, inside: TileRef): void {
  game.setMaritimeZone({
    center: () => inside,
    contains: (tile) => tile === inside,
    randomPatrolTile: () => inside,
  });
}

describe("maritime zone registration", () => {
  it("the circular objective registers a zone on the game at init", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.Team,
      playerTeams: 2,
    });
    expect(game.maritimeZone()).toBeNull();

    const exec = new MaritimeObjectiveExecution();
    exec.init(game, 0);

    const zone = game.maritimeZone();
    expect(zone).not.toBeNull();
    expect(zone!.contains(exec.snapshot().center)).toBe(true);
    expect(game.isWater(zone!.randomPatrolTile(new PseudoRandom(1)))).toBe(
      true,
    );
  });

  it("the trade-lane objective registers a zone on the game at init", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const exec = new TradeLaneObjectiveExecution();
    exec.init(game, 0);

    const zone = game.maritimeZone();
    expect(zone).not.toBeNull();
    expect(game.isWater(zone!.randomPatrolTile(new PseudoRandom(1)))).toBe(
      true,
    );
    expect(zone!.contains(zone!.randomPatrolTile(new PseudoRandom(2)))).toBe(
      true,
    );
  });
});

describe("NationMaritimeBehavior", () => {
  it("does nothing when no maritime zone is registered", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const nation = addNation(game);
    const addExecution = vi.spyOn(game, "addExecution");

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    behavior.contestObjective();

    expect(addExecution).not.toHaveBeenCalled();
  });

  it("retasks a warship patrolling off the objective into the zone", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const inside = game.ref(12, 8);
    registerStubZone(game, inside);
    const nation = addNation(game);
    const outside = game.ref(9, 1);
    const warship = nation.buildUnit(UnitType.Warship, outside, {
      patrolTile: outside,
    });
    expect(game.maritimeZone()!.contains(outside)).toBe(false);

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    behavior.contestObjective();

    const patrolTile = warship.warshipState().patrolTile;
    expect(patrolTile).toBeDefined();
    expect(game.maritimeZone()!.contains(patrolTile!)).toBe(true);
  });

  it("builds a warship aimed at the zone when it has none and can afford it", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const exec = new TradeLaneObjectiveExecution();
    exec.init(game, 0);
    const nation = addNation(game);
    const addExecution = vi.spyOn(game, "addExecution");

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    behavior.contestObjective();

    expect(addExecution).toHaveBeenCalledTimes(1);
    expect(addExecution.mock.calls[0][0]).toBeInstanceOf(ConstructionExecution);
  });

  it("stands down once enough of its warships patrol the objective", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const exec = new TradeLaneObjectiveExecution();
    exec.init(game, 0);
    const nation = addNation(game);
    const zone = game.maritimeZone()!;
    const inside = zone.randomPatrolTile(new PseudoRandom(1));
    for (let i = 0; i < 3; i++) {
      nation.buildUnit(UnitType.Warship, inside, { patrolTile: inside });
    }
    const addExecution = vi.spyOn(game, "addExecution");

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    behavior.contestObjective();

    expect(addExecution).not.toHaveBeenCalled();
    for (const warship of nation.units(UnitType.Warship)) {
      expect(warship.warshipState().patrolTile).toBe(inside);
    }
  });

  it("escalates its detachment to outmatch a rival fleet inside the zone", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const inside = game.ref(12, 8);
    registerStubZone(game, inside);
    const nation = addNation(game);
    game.addPlayer(new PlayerInfo("rival", PlayerType.Human, null, "rival_id"));
    const rival = game.player("rival_id");
    for (let i = 0; i < 2; i++) {
      rival.buildUnit(UnitType.Warship, inside, { patrolTile: inside });
      nation.buildUnit(UnitType.Warship, inside, { patrolTile: inside });
    }
    // Base detachment (2) is already patrolling, but the rival fields power 6:
    // the nation must keep escalating instead of standing down.
    const outside = game.ref(9, 1);
    const spare = nation.buildUnit(UnitType.Warship, outside, {
      patrolTile: outside,
    });

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    behavior.contestObjective();

    expect(
      game.maritimeZone()!.contains(spare.warshipState().patrolTile!),
    ).toBe(true);
  });

  it("caps the escalated detachment at the capture-stall threshold", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const inside = game.ref(12, 8);
    registerStubZone(game, inside);
    const nation = addNation(game);
    game.addPlayer(new PlayerInfo("rival", PlayerType.Human, null, "rival_id"));
    const rival = game.player("rival_id");
    for (let i = 0; i < 20; i++) {
      rival.buildUnit(UnitType.Warship, inside, { patrolTile: inside });
    }
    for (let i = 0; i < 4; i++) {
      nation.buildUnit(UnitType.Warship, inside, { patrolTile: inside });
    }
    const addExecution = vi.spyOn(game, "addExecution");

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    behavior.contestObjective();

    // Four patrolling hulls already stall any spam at the capture cap;
    // matching the rival ship-for-ship would be wasted gold.
    expect(addExecution).not.toHaveBeenCalled();
  });

  it("does not build past the warship cap", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const inside = game.ref(12, 8);
    registerStubZone(game, inside);
    const nation = addNation(game);
    const outside = game.ref(9, 1);
    for (let i = 0; i < 10; i++) {
      nation.buildUnit(UnitType.Warship, outside, { patrolTile: outside });
    }
    const addExecution = vi.spyOn(game, "addExecution");

    const behavior = new NationMaritimeBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    // Drain every retask; afterwards desired is satisfied so nothing builds.
    for (let i = 0; i < 12; i++) {
      behavior.contestObjective();
    }

    expect(addExecution).not.toHaveBeenCalled();
    expect(nation.units(UnitType.Warship)).toHaveLength(10);
  });
});

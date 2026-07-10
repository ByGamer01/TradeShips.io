import { describe, expect, it, vi } from "vitest";
import { TradeLaneObjectiveExecution } from "../../../src/core/execution/TradeLaneObjectiveExecution";
import { GameMode, PlayerType, UnitType } from "../../../src/core/game/Game";
import {
  GameUpdate,
  GameUpdateType,
  MaritimeObjectiveUpdate,
} from "../../../src/core/game/GameUpdates";
import { playerInfo, setup } from "../../util/Setup";

function runTicks(exec: TradeLaneObjectiveExecution, ticks: number): void {
  for (let tick = 0; tick < ticks; tick++) {
    exec.tick(tick);
  }
}

function laneCenter(exec: TradeLaneObjectiveExecution): number {
  const path = exec.snapshot().path;
  return path[(path.length / 2) | 0];
}

describe("TradeLaneObjectiveExecution", () => {
  it("sets a winner when one fleet reaches full trade-lane control", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const player = game.addPlayer(playerInfo("player", PlayerType.Human));
    const exec = new TradeLaneObjectiveExecution();
    const setWinnerSpy = vi.fn();
    game.setWinner = setWinnerSpy;

    exec.init(game, 0);
    expect(exec.snapshot().usedFallback).toBe(false);
    player.buildUnit(UnitType.AircraftCarrier, laneCenter(exec), {});

    runTicks(exec, 900);

    expect(setWinnerSpy).toHaveBeenCalledWith(player, expect.anything());
    expect(exec.snapshot().status).toBe("controlled");
    expect(exec.isActive()).toBe(false);
  });

  it("only counts naval power inside the corridor", async () => {
    const game = await setup("world", {
      gameMode: GameMode.FFA,
    });
    const inside = game.addPlayer(playerInfo("inside", PlayerType.Human));
    const outside = game.addPlayer(playerInfo("outside", PlayerType.Human));
    const exec = new TradeLaneObjectiveExecution();

    exec.init(game, 0);
    const snapshot = exec.snapshot();
    const membership = (exec as any).lane.membership as Uint8Array;
    let outsideWater = -1;
    for (let tile = game.width() * game.height() - 1; tile >= 0; tile--) {
      if (game.isWater(tile) && membership[tile] === 0) {
        outsideWater = tile;
        break;
      }
    }
    expect(outsideWater).toBeGreaterThanOrEqual(0);

    const center = laneCenter(exec);
    inside.buildUnit(UnitType.Warship, center, { patrolTile: center });
    outside.buildUnit(UnitType.Warship, outsideWater, {
      patrolTile: outsideWater,
    });
    exec.tick(1);

    const after = exec.snapshot();
    expect(after.navalPower).toHaveLength(1);
    expect(after.navalPower[0].controller).toBe(inside);
    expect(after.status).toBe("capturing");
    expect(snapshot.halfWidth).toBeGreaterThan(0);
  });

  it("freezes progress while equally strong rivals contest the lane", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const playerA = game.addPlayer(playerInfo("a", PlayerType.Human));
    const playerB = game.addPlayer(playerInfo("b", PlayerType.Human));
    const exec = new TradeLaneObjectiveExecution();

    exec.init(game, 0);
    const center = laneCenter(exec);
    playerA.buildUnit(UnitType.Warship, center, { patrolTile: center });
    playerB.buildUnit(UnitType.Submarine, center, {});
    exec.tick(1);

    expect(exec.snapshot()).toMatchObject({
      leader: null,
      controlPercent: 0,
      status: "contested",
    });
  });

  it("emits the corridor path on the first update only", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const player = game.addPlayer(playerInfo("player", PlayerType.Human));
    const exec = new TradeLaneObjectiveExecution();

    exec.init(game, 0);
    const center = laneCenter(exec);
    player.buildUnit(UnitType.Warship, center, { patrolTile: center });

    const updates: GameUpdate[] = [];
    game.addUpdate = (update: GameUpdate) => updates.push(update);
    exec.tick(1);
    exec.tick(2);

    const objectives = updates.filter(
      (u): u is MaritimeObjectiveUpdate =>
        u.type === GameUpdateType.MaritimeObjective,
    );
    expect(objectives).toHaveLength(2);
    expect(objectives[0].shape).toBe("lane");
    expect(objectives[0].path).toBeDefined();
    expect(objectives[0].path!.length).toBeGreaterThan(1);
    expect(objectives[0].laneHalfWidth).toBeGreaterThan(0);
    expect(objectives[1].path).toBeUndefined();
    expect(objectives[0]).toMatchObject({
      controllerSmallID: player.smallID(),
      leaderSmallID: player.smallID(),
      status: "capturing",
    });
  });

  it("falls back to the circular objective on maps without a corridor", async () => {
    const game = await setup("plains", { gameMode: GameMode.FFA });
    const exec = new TradeLaneObjectiveExecution();

    exec.init(game, 0);

    expect(exec.snapshot().usedFallback).toBe(true);
    // Delegated ticking must not crash and keeps the execution alive.
    exec.tick(1);
    expect(exec.isActive()).toBe(true);
  });
});

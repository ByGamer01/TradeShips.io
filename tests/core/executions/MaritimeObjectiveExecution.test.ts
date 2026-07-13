import { describe, expect, it, vi } from "vitest";
import { MaritimeObjectiveExecution } from "../../../src/core/execution/MaritimeObjectiveExecution";
import {
  ColoredTeams,
  GameMode,
  Player,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import {
  GameUpdate,
  GameUpdateType,
  MaritimeObjectiveUpdate,
} from "../../../src/core/game/GameUpdates";
import { playerInfo, setup } from "../../util/Setup";

function runTicks(exec: MaritimeObjectiveExecution, ticks: number): void {
  for (let tick = 0; tick < ticks; tick++) {
    exec.tick(tick);
  }
}

describe("MaritimeObjectiveExecution", () => {
  it("sets a player winner when one fleet reaches full sea-route control", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const player = game.addPlayer(playerInfo("player", PlayerType.Human));
    const exec = new MaritimeObjectiveExecution();
    const setWinnerSpy = vi.fn();
    game.setWinner = setWinnerSpy;

    exec.init(game, 0);
    player.buildUnit(UnitType.AircraftCarrier, exec.snapshot().center, {});
    player.addGold(game.config().economicVictoryGold());

    runTicks(exec, 900);

    expect(setWinnerSpy).toHaveBeenCalledWith(player, expect.anything());
    expect(exec.snapshot().status).toBe("controlled");
    expect(exec.isActive()).toBe(false);
  });

  it("does not win with full control until the controller also holds 500M debt-free gold", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const player = game.addPlayer(playerInfo("player", PlayerType.Human));
    const exec = new MaritimeObjectiveExecution();
    const setWinnerSpy = vi.fn();
    game.setWinner = setWinnerSpy;

    exec.init(game, 0);
    player.buildUnit(UnitType.AircraftCarrier, exec.snapshot().center, {});
    runTicks(exec, 900);

    expect(exec.snapshot().status).toBe("controlled");
    expect(setWinnerSpy).not.toHaveBeenCalled();
    expect(exec.isActive()).toBe(true);

    player.addGold(game.config().economicVictoryGold());
    exec.tick(901);

    expect(setWinnerSpy).toHaveBeenCalledWith(player, expect.anything());
    expect(exec.isActive()).toBe(false);
  });

  it("aggregates same-team fleets into one maritime controller", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.Team,
      playerTeams: 2,
    });
    const red1 = (game as any).addPlayer(
      playerInfo("red1", PlayerType.Human),
      ColoredTeams.Red,
    ) as Player;
    const red2 = (game as any).addPlayer(
      playerInfo("red2", PlayerType.Human),
      ColoredTeams.Red,
    ) as Player;
    const blue = (game as any).addPlayer(
      playerInfo("blue", PlayerType.Human),
      ColoredTeams.Blue,
    ) as Player;
    const exec = new MaritimeObjectiveExecution();

    exec.init(game, 0);
    const center = exec.snapshot().center;
    red1.buildUnit(UnitType.Warship, center, { patrolTile: center });
    red2.buildUnit(UnitType.Warship, center, { patrolTile: center });
    blue.buildUnit(UnitType.Warship, center, { patrolTile: center });
    exec.tick(1);

    const snapshot = exec.snapshot();
    expect(snapshot.status).toBe("capturing");
    expect(snapshot.leader).toBe(ColoredTeams.Red);
    expect(snapshot.navalPower[0].power).toBe(6);
  });

  it("ignores trade ships when weighing route control", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const trader = game.addPlayer(playerInfo("trader", PlayerType.Human));
    const navy = game.addPlayer(playerInfo("navy", PlayerType.Human));
    const exec = new MaritimeObjectiveExecution();

    exec.init(game, 0);
    const center = exec.snapshot().center;
    const warship = navy.buildUnit(UnitType.Warship, center, {
      patrolTile: center,
    });
    trader.buildUnit(UnitType.TradeShip, center, { targetUnit: warship });
    exec.tick(1);

    const snapshot = exec.snapshot();
    expect(snapshot.leader).toBe(navy);
    expect(
      snapshot.navalPower.find((entry) => entry.controller === trader),
    ).toBeUndefined();
  });

  it("pauses progress while equally strong rival fleets contest the route", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const playerA = game.addPlayer(playerInfo("a", PlayerType.Human));
    const playerB = game.addPlayer(playerInfo("b", PlayerType.Human));
    const exec = new MaritimeObjectiveExecution();

    exec.init(game, 0);
    const center = exec.snapshot().center;
    playerA.buildUnit(UnitType.Warship, center, { patrolTile: center });
    playerB.buildUnit(UnitType.Submarine, center, {});
    exec.tick(1);

    expect(exec.snapshot()).toMatchObject({
      leader: null,
      controlPercent: 0,
      status: "contested",
    });
  });

  it("emits an authoritative maritime objective update each tick", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const player = game.addPlayer(playerInfo("player", PlayerType.Human));
    const exec = new MaritimeObjectiveExecution();

    exec.init(game, 0);
    const center = exec.snapshot().center;
    player.buildUnit(UnitType.Warship, center, { patrolTile: center });

    const updates: GameUpdate[] = [];
    game.addUpdate = (update: GameUpdate) => updates.push(update);
    exec.tick(1);

    const objective = updates.find(
      (u): u is MaritimeObjectiveUpdate =>
        u.type === GameUpdateType.MaritimeObjective,
    );
    expect(objective).toMatchObject({
      center,
      controllerSmallID: player.smallID(),
      controllerTeam: null,
      leaderSmallID: player.smallID(),
      leaderTeam: null,
      status: "capturing",
    });
    expect(objective?.radius).toBeGreaterThan(0);
    expect(objective?.controlPercent).toBeGreaterThan(0);
    expect(objective?.navalPower).toEqual([
      { smallID: player.smallID(), team: null, power: 3 },
    ]);
  });

  it("emits team-controlled updates without a player smallID in team mode", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.Team,
      playerTeams: 2,
    });
    const red = (game as any).addPlayer(
      playerInfo("red", PlayerType.Human),
      ColoredTeams.Red,
    ) as Player;
    const exec = new MaritimeObjectiveExecution();

    exec.init(game, 0);
    const center = exec.snapshot().center;
    red.buildUnit(UnitType.Warship, center, { patrolTile: center });

    const updates: GameUpdate[] = [];
    game.addUpdate = (update: GameUpdate) => updates.push(update);
    exec.tick(1);

    const objective = updates.find(
      (u): u is MaritimeObjectiveUpdate =>
        u.type === GameUpdateType.MaritimeObjective,
    );
    expect(objective).toMatchObject({
      controllerSmallID: 0,
      controllerTeam: ColoredTeams.Red,
      leaderSmallID: 0,
      leaderTeam: ColoredTeams.Red,
      status: "capturing",
    });
    expect(objective?.navalPower).toEqual([
      { smallID: 0, team: ColoredTeams.Red, power: 3 },
    ]);
  });
});

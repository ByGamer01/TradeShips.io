import { describe, expect, it } from "vitest";
import { Leaderboard } from "../../../src/client/hud/layers/Leaderboard";
import { TeamStats } from "../../../src/client/hud/layers/TeamStats";
import { GameMode, UnitType } from "../../../src/core/game/Game";

function player(overrides: Record<string, unknown> = {}) {
  const data = {
    id: "p1",
    smallID: 1,
    name: "Player 1",
    team: null,
    tiles: 100,
    gold: 0n,
    debt: 0n,
    bankrupt: false,
    alive: true,
    ...overrides,
  };
  return {
    id: () => data.id,
    smallID: () => data.smallID,
    displayName: () => data.name,
    team: () => data.team,
    numTilesOwned: () => data.tiles,
    gold: () => data.gold,
    debt: () => data.debt,
    isBankrupt: () => data.bankrupt,
    isAlive: () => data.alive,
    isOnSameTeam: (other: { team: () => string | null }) =>
      data.team !== null && data.team === other.team(),
    totalUnitLevels: (type: UnitType) => (type === UnitType.Warship ? 1 : 0),
  };
}

describe("maritime leaderboard scoring", () => {
  it("ranks players by central sea control instead of territorial ownership", () => {
    const landLeader = player({
      id: "p1",
      smallID: 1,
      name: "Land Leader",
      tiles: 900,
    });
    const seaLeader = player({
      id: "p2",
      smallID: 2,
      name: "Sea Leader",
      tiles: 10,
    });
    const el = new Leaderboard();
    el.game = {
      myPlayer: () => landLeader,
      playerViews: () => [landLeader, seaLeader],
      numLandTiles: () => 1000,
      numTilesWithFallout: () => 0,
      config: () => ({ maxTroops: () => 1000 }),
      frameData: () => ({
        maritimeObjective: {
          controllerID: 2,
          controllerTeam: null,
          leaderID: 2,
          leaderTeam: null,
          controlPercent: 67,
          navalPower: [{ ownerID: 2, team: null, power: 6 }],
        },
      }),
    } as any;

    (el as any).updateLeaderboard();

    expect(el.players[0].player).toBe(seaLeader);
    expect(el.players[0].score).toBe("67.0%");
    expect(el.players[1].score).toBe("0.0%");
  });

  it("exposes debt and bankruptcy for diplomatic decisions", () => {
    const solvent = player({ id: "p1", debt: 0n });
    const bankrupt = player({
      id: "p2",
      smallID: 2,
      debt: 2_500_000n,
      bankrupt: true,
    });
    const el = new Leaderboard();
    el.game = {
      myPlayer: () => solvent,
      playerViews: () => [solvent, bankrupt],
      numLandTiles: () => 1000,
      numTilesWithFallout: () => 0,
      config: () => ({ maxTroops: () => 1000 }),
      frameData: () => ({ maritimeObjective: null }),
    } as any;

    (el as any).updateLeaderboard();

    const entry = el.players.find((candidate) => candidate.player.id() === "p2");
    expect(entry?.debt).toBe("2.50M");
    expect(entry?.isBankrupt).toBe(true);
  });

  it("ranks teams by central sea control instead of territorial ownership", () => {
    const blue = player({
      id: "p1",
      smallID: 1,
      name: "Blue",
      team: "Blue",
      tiles: 900,
    });
    const red = player({
      id: "p2",
      smallID: 2,
      name: "Red",
      team: "Red",
      tiles: 10,
    });
    const el = new TeamStats();
    el.game = {
      myPlayer: () => blue,
      playerViews: () => [blue, red],
      numLandTiles: () => 1000,
      numTilesWithFallout: () => 0,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.Team }),
        maxTroops: () => 1000,
      }),
      frameData: () => ({
        maritimeObjective: {
          controllerID: 0,
          controllerTeam: "Red",
          leaderID: 0,
          leaderTeam: "Red",
          controlPercent: 72,
          navalPower: [{ ownerID: 0, team: "Red", power: 6 }],
        },
      }),
    } as any;

    (el as any).updateTeamStats();

    expect(el.teams[0].teamName).toBe("Red");
    expect(el.teams[0].totalScoreStr).toBe("72.0%");
    expect(el.teams[1].totalScoreStr).toBe("0.0%");
  });
});

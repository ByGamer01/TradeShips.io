import {
  Difficulty,
  DISABLED_ARSENAL,
  Game,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { UserSettings } from "../src/core/game/UserSettings";
import { GameConfig } from "../src/core/Schemas";
import { setup } from "./util/Setup";
import { TestConfig } from "./util/TestConfig";
import { executeTicks } from "./util/utils";

describe("DISABLED_ARSENAL", () => {
  test("contains exactly the 8 arsenal unit types", () => {
    expect(DISABLED_ARSENAL).toHaveLength(8);
    expect(new Set(DISABLED_ARSENAL)).toEqual(
      new Set([
        UnitType.AtomBomb,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
        UnitType.MIRVWarhead,
        UnitType.MissileSilo,
        UnitType.SAMLauncher,
        UnitType.SAMMissile,
        UnitType.DefensePost,
      ]),
    );
  });

  test("never disables a child projectile without its parent (parent-child invariant)", () => {
    if (DISABLED_ARSENAL.includes(UnitType.MIRVWarhead)) {
      expect(DISABLED_ARSENAL).toContain(UnitType.MIRV);
    }
    if (DISABLED_ARSENAL.includes(UnitType.SAMMissile)) {
      expect(DISABLED_ARSENAL).toContain(UnitType.SAMLauncher);
    }
  });

  // REQ-7.2 — proves BuildMenu.ts needs no edit: its existing
  // `!config().isUnitDisabled(item.unitType)` filter already excludes every
  // arsenal member once disabledUnits contains the arsenal.
  test("Config.isUnitDisabled returns true for every arsenal member when disabledUnits is the arsenal", () => {
    const gameConfig: GameConfig = {
      gameMap: GameMapType.Asia,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Singleplayer,
      difficulty: Difficulty.Medium,
      nations: "default",
      donateGold: false,
      donateTroops: false,
      bots: 0,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      disabledUnits: [...DISABLED_ARSENAL],
    };
    const config = new TestConfig(gameConfig, new UserSettings(), false);

    for (const unit of DISABLED_ARSENAL) {
      expect(config.isUnitDisabled(unit)).toBe(true);
    }
  });
});

// WU-6 — core simulation regression lock (REQ-1/REQ-3, children invariant).
// No src/core logic changes here: this only proves the existing
// isUnitDisabled gate (PlayerImpl.canBuildUnitType / buildUnit,
// Config.isUnitDisabled) already covers the naval-trim arsenal lock
// end-to-end, for both Human and Nation player types. If any of these
// regress in the future, escalate to design — do NOT patch core logic to
// force them green.
describe("Arsenal lock regression (core simulation)", () => {
  const ALLOWED_TYPES = [
    UnitType.Port,
    UnitType.Warship,
    UnitType.City,
    UnitType.Factory,
    UnitType.TransportShip,
  ] as const;

  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { disabledUnits: [...DISABLED_ARSENAL], instantBuild: true },
      [new PlayerInfo("player", PlayerType.Human, null, "player_id")],
    );
    player = game.player("player_id");
    player.addGold(BigInt(1_000_000));
  });

  test("1.1 — arsenal types are not buildable, allowed naval-economic types are", () => {
    for (const unit of DISABLED_ARSENAL) {
      expect(game.config().isUnitDisabled(unit)).toBe(true);
      expect(player.canBuild(unit, game.ref(0, 0))).toBe(false);
    }
    for (const unit of ALLOWED_TYPES) {
      expect(game.config().isUnitDisabled(unit)).toBe(false);
    }
  });

  test("1.2 — buildUnit throws for every arsenal type and never creates the unit", () => {
    for (const unit of DISABLED_ARSENAL) {
      expect(() => player.buildUnit(unit, game.ref(0, 0), {})).toThrow();
      expect(game.units(unit)).toHaveLength(0);
    }
  });

  test("3.1 — a Nation-type player is gated identically and never accumulates arsenal units across ticks", () => {
    game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
    );
    const nation = game.player("nation_id");
    nation.addGold(BigInt(1_000_000));

    for (const unit of DISABLED_ARSENAL) {
      expect(() => nation.buildUnit(unit, game.ref(0, 0), {})).toThrow();
    }

    executeTicks(game, 20);

    for (const unit of DISABLED_ARSENAL) {
      expect(game.units(unit)).toHaveLength(0);
    }
  });

  test("children invariant — SAMMissile and MIRVWarhead stay disabled alongside their parents", () => {
    const config = game.config();
    expect(config.isUnitDisabled(UnitType.SAMMissile)).toBe(true);
    expect(config.isUnitDisabled(UnitType.SAMLauncher)).toBe(true);
    expect(config.isUnitDisabled(UnitType.MIRVWarhead)).toBe(true);
    expect(config.isUnitDisabled(UnitType.MIRV)).toBe(true);
  });
});

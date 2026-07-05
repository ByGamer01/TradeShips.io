import {
  Difficulty,
  DISABLED_ARSENAL,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  UnitType,
} from "../src/core/game/Game";
import { UserSettings } from "../src/core/game/UserSettings";
import { GameConfig } from "../src/core/Schemas";
import { TestConfig } from "./util/TestConfig";

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

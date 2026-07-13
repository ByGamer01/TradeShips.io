import { TorpedoExecution } from "../../../src/core/execution/TorpedoExecution";
import {
  BuildMenus,
  DISABLED_ARSENAL,
  Game,
  Player,
  PlayerInfo,
  PlayerBuildable,
  PlayerType,
  Structures,
  UnitType,
} from "../../../src/core/game/Game";
import { PathStatus } from "../../../src/core/pathfinding/types";
import { setup } from "../../util/Setup";

const coastX = 7;

describe("TorpedoExecution", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("attacker", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("defender", PlayerType.Human, null, "player_2_id"),
      ],
    );

    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
  });

  test("is registered as a projectile and not as a buildable unit", () => {
    expect(UnitType.Torpedo).toBe("Torpedo");
    expect(game.config().unitInfo(UnitType.Torpedo).cost(game, player1)).toBe(
      0n,
    );
    expect(game.config().unitInfo(UnitType.Torpedo).damage).toBe(300);
    expect(game.config().torpedoLifetime()).toBe(70);
    expect(game.config().torpedoStepsPerTick()).toBe(2);
    expect(game.config().submarineTorpedoAttackRate()).toBe(20);

    expect(DISABLED_ARSENAL).not.toContain(UnitType.Torpedo);
    expect(Structures.types).not.toContain(UnitType.Torpedo);
    expect(BuildMenus.types).not.toContain(UnitType.Torpedo);
    expect(PlayerBuildable.types).not.toContain(UnitType.Torpedo);
  });

  test("uses deterministic damage for the same tick seed", () => {
    const launcher = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const target = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 5, 10),
      { patrolTile: game.ref(coastX + 5, 10) },
    );

    const torpedo1 = new TorpedoExecution(
      launcher.tile(),
      player1,
      launcher,
      target,
    );
    const torpedo2 = new TorpedoExecution(
      launcher.tile(),
      player1,
      launcher,
      target,
    );

    torpedo1.init(game, game.ticks());
    torpedo2.init(game, game.ticks());

    expect(torpedo1.getEffectOnTargetForTesting()).toBe(
      torpedo2.getEffectOnTargetForTesting(),
    );
  });

  test("moves through water, damages the target, and deletes itself", () => {
    const launcher = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const target = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 4, 10),
      { patrolTile: game.ref(coastX + 4, 10) },
    );
    const healthBefore = target.health();

    const torpedo = new TorpedoExecution(
      launcher.tile(),
      player1,
      launcher,
      target,
    );
    torpedo.init(game, game.ticks());

    for (let i = 0; i < 20 && torpedo.isActive(); i++) {
      torpedo.tick(game.ticks());
    }

    expect(target.health()).toBeLessThan(healthBefore);
    expect(torpedo.isActive()).toBe(false);
    expect(game.units(UnitType.Torpedo)).toHaveLength(0);
  });

  test("self-deletes without damage when water pathfinding cannot find a route", () => {
    const launcher = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const target = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 4, 10),
      { patrolTile: game.ref(coastX + 4, 10) },
    );
    const healthBefore = target.health();

    const torpedo = new TorpedoExecution(
      launcher.tile(),
      player1,
      launcher,
      target,
    );
    torpedo.init(game, game.ticks());
    (torpedo as any).pathFinder = {
      findPath: () => null,
      invalidate: () => undefined,
      next: () => ({ status: PathStatus.NOT_FOUND }),
    };

    torpedo.tick(game.ticks());

    expect(target.health()).toBe(healthBefore);
    expect(torpedo.isActive()).toBe(false);
    expect(game.units(UnitType.Torpedo)).toHaveLength(0);
  });
});

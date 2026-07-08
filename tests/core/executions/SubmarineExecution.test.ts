import { NavalMineExecution } from "../../../src/core/execution/NavalMineExecution";
import { SubmarineExecution } from "../../../src/core/execution/SubmarineExecution";
import { WarshipExecution } from "../../../src/core/execution/WarshipExecution";
import {
  BuildableAttacks,
  BuildMenus,
  DISABLED_ARSENAL,
  Game,
  Player,
  PlayerBuildable,
  PlayerInfo,
  PlayerType,
  Structures,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";
import { constructionExecution } from "../../util/utils";

const coastX = 7;

describe("SubmarineExecution", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("captain", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("enemy", PlayerType.Human, null, "player_2_id"),
      ],
    );

    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");

    const portTile = game.ref(coastX, 10);
    player1.conquer(portTile);
    player1.buildUnit(UnitType.Port, portTile, {});
  });

  test("is registered as a naval buildable with dedicated combat config", () => {
    const info = game.config().unitInfo(UnitType.Submarine);

    expect(UnitType.Submarine).toBe("Submarine");
    expect(info.maxHealth).toBe(500);
    expect(game.config().submarineEngagementRange()).toBe(20);
    expect(game.config().submarineTorpedoAttackRate()).toBe(20);

    expect(DISABLED_ARSENAL).not.toContain(UnitType.Submarine);
    expect(Structures.types).not.toContain(UnitType.Submarine);
    expect(BuildableAttacks.types).toContain(UnitType.Submarine);
    expect(BuildMenus.types).toContain(UnitType.Submarine);
    expect(PlayerBuildable.types).toContain(UnitType.Submarine);
  });

  test("prices submarines below warships with escalating cost", async () => {
    const normalGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [new PlayerInfo("captain", PlayerType.Human, null, "normal_captain")],
    );
    const normalPlayer = normalGame.player("normal_captain");
    const info = normalGame.config().unitInfo(UnitType.Submarine);

    expect(info.cost(normalGame, normalPlayer)).toBe(200_000n);

    normalPlayer.buildUnit(
      UnitType.Submarine,
      normalGame.ref(coastX + 2, 10),
      {},
    );

    expect(info.cost(normalGame, normalPlayer)).toBe(400_000n);
  });

  test("spawns from the nearest connected port like a warship", () => {
    const portTile = game.ref(coastX, 10);

    expect(player1.canBuild(UnitType.Submarine, game.ref(coastX + 3, 10))).toBe(
      portTile,
    );

    constructionExecution(
      game,
      player1,
      coastX + 3,
      10,
      UnitType.Submarine,
      3,
    );

    const subs = game.units(UnitType.Submarine);
    expect(subs).toHaveLength(1);
    expect(subs[0]!.isActive()).toBe(true);
  });

  test("cannot be built without a port", () => {
    player2.conquer(game.ref(coastX, 12));
    expect(player2.canBuild(UnitType.Submarine, game.ref(coastX + 3, 12))).toBe(
      false,
    );
  });

  test("torpedoes enemy warships while patrolling", () => {
    game.config().submarineTorpedoAttackRate = () => 1;

    const enemyWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 5, 10),
      { patrolTile: game.ref(coastX + 5, 10) },
    );

    game.addExecution(
      new SubmarineExecution(player1, game.ref(coastX + 2, 10)),
    );

    for (let i = 0; i < 20; i++) {
      game.executeNextTick();
    }

    expect(Number(enemyWarship.health())).toBeLessThan(1000);
  });

  test("sinks enemy trade ships instead of capturing them", () => {
    game.config().submarineTorpedoAttackRate = () => 1;

    const enemyPortTile = game.ref(coastX, 13);
    player2.conquer(enemyPortTile);
    const enemyPort = player2.buildUnit(UnitType.Port, enemyPortTile, {});
    const tradeShip = player2.buildUnit(
      UnitType.TradeShip,
      game.ref(coastX + 4, 11),
      { targetUnit: enemyPort },
    );

    game.addExecution(
      new SubmarineExecution(player1, game.ref(coastX + 2, 10)),
    );

    // Trade ships spawn safe from pirates for safeFromPiratesCooldownMax
    // ticks; run past the cooldown plus torpedo travel time.
    for (let i = 0; i < 60; i++) {
      game.executeNextTick();
    }

    expect(tradeShip.isActive()).toBe(false);
    expect(tradeShip.owner()).toBe(player2);
  });

  test("does not attack allied ships", () => {
    game.config().submarineTorpedoAttackRate = () => 1;

    const allianceRequest = player1.createAllianceRequest(player2);
    expect(allianceRequest).not.toBeNull();
    allianceRequest!.accept();

    const alliedWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 5, 10),
      { patrolTile: game.ref(coastX + 5, 10) },
    );

    game.addExecution(
      new SubmarineExecution(player1, game.ref(coastX + 2, 10)),
    );

    for (let i = 0; i < 20; i++) {
      game.executeNextTick();
    }

    expect(Number(alliedWarship.health())).toBe(1000);
  });

  test("warships only engage submarines inside the engagement range", () => {
    game.config().submarineEngagementRange = () => 2;
    game.config().warshipTorpedoAttackRate = () => 1;
    game.config().warshipPatrolRange = () => 2;

    const farSub = player1.buildUnit(
      UnitType.Submarine,
      game.ref(coastX + 1, 10),
      {},
    );
    const enemyWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 7, 10),
      { patrolTile: game.ref(coastX + 7, 10) },
    );
    game.addExecution(new WarshipExecution(enemyWarship));

    for (let i = 0; i < 10; i++) {
      game.executeNextTick();
    }

    expect(Number(farSub.health())).toBe(500);

    const nearSub = player1.buildUnit(
      UnitType.Submarine,
      game.ref(coastX + 6, 10),
      {},
    );

    for (let i = 0; i < 20; i++) {
      game.executeNextTick();
    }

    expect(Number(nearSub.health())).toBeLessThan(500);
  });

  test("naval mines detonate against enemy submarines", () => {
    const mineTile = game.ref(coastX + 2, 10);
    const enemySub = player2.buildUnit(
      UnitType.Submarine,
      game.ref(coastX + 3, 10),
      {},
    );

    const execution = new NavalMineExecution(player1, mineTile);
    execution.init(game, game.ticks());
    execution.tick(game.ticks());

    expect(enemySub.isActive()).toBe(false);
    expect(game.units(UnitType.NavalMine)).toHaveLength(0);
  });
});

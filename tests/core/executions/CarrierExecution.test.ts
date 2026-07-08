import { AircraftExecution } from "../../../src/core/execution/AircraftExecution";
import { CarrierExecution } from "../../../src/core/execution/CarrierExecution";
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

describe("CarrierExecution", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("admiral", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("enemy", PlayerType.Human, null, "player_2_id"),
      ],
    );

    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");

    const portTile = game.ref(coastX, 10);
    player1.conquer(portTile);
    player1.buildUnit(UnitType.Port, portTile, {});
  });

  test("is registered as a naval buildable with dedicated strike config", () => {
    const carrierInfo = game.config().unitInfo(UnitType.AircraftCarrier);
    const aircraftInfo = game.config().unitInfo(UnitType.Aircraft);

    expect(UnitType.AircraftCarrier).toBe("Aircraft Carrier");
    expect(UnitType.Aircraft).toBe("Aircraft");
    expect(carrierInfo.maxHealth).toBe(1500);
    expect(aircraftInfo.cost(game, player1)).toBe(0n);
    expect(aircraftInfo.damage).toBe(200);
    expect(game.config().carrierStrikeRange()).toBe(70);
    expect(game.config().carrierAircraftAttackRate()).toBe(40);
    expect(game.config().aircraftStepsPerTick()).toBe(3);
    expect(game.config().aircraftLifetime()).toBe(100);

    expect(DISABLED_ARSENAL).not.toContain(UnitType.AircraftCarrier);
    expect(Structures.types).not.toContain(UnitType.AircraftCarrier);
    expect(BuildableAttacks.types).toContain(UnitType.AircraftCarrier);
    expect(BuildMenus.types).toContain(UnitType.AircraftCarrier);
    expect(PlayerBuildable.types).toContain(UnitType.AircraftCarrier);
    expect(PlayerBuildable.types).not.toContain(UnitType.Aircraft);
  });

  test("prices carriers above warships with escalating cost", async () => {
    const normalGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [new PlayerInfo("admiral", PlayerType.Human, null, "normal_admiral")],
    );
    const normalPlayer = normalGame.player("normal_admiral");
    const info = normalGame.config().unitInfo(UnitType.AircraftCarrier);

    expect(info.cost(normalGame, normalPlayer)).toBe(400_000n);

    normalPlayer.buildUnit(
      UnitType.AircraftCarrier,
      normalGame.ref(coastX + 2, 10),
      {},
    );

    expect(info.cost(normalGame, normalPlayer)).toBe(800_000n);
  });

  test("spawns from the nearest connected port like a warship", () => {
    const portTile = game.ref(coastX, 10);

    expect(
      player1.canBuild(UnitType.AircraftCarrier, game.ref(coastX + 3, 10)),
    ).toBe(portTile);

    constructionExecution(
      game,
      player1,
      coastX + 3,
      10,
      UnitType.AircraftCarrier,
      3,
    );

    const carriers = game.units(UnitType.AircraftCarrier);
    expect(carriers).toHaveLength(1);
    expect(carriers[0]!.isActive()).toBe(true);
  });

  test("launches aircraft that damage enemy warships in strike range", () => {
    game.config().carrierAircraftAttackRate = () => 1;

    const enemyWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 6, 10),
      { patrolTile: game.ref(coastX + 6, 10) },
    );

    game.addExecution(new CarrierExecution(player1, game.ref(coastX + 2, 10)));

    let sawAircraft = false;
    for (let i = 0; i < 25; i++) {
      game.executeNextTick();
      sawAircraft ||= game.units(UnitType.Aircraft).length > 0;
    }

    expect(sawAircraft).toBe(true);
    expect(Number(enemyWarship.health())).toBeLessThan(1000);
  });

  test("does not strike targets beyond the strike range", () => {
    game.config().carrierAircraftAttackRate = () => 1;
    game.config().carrierStrikeRange = () => 2;
    game.config().warshipPatrolRange = () => 2;

    const enemyWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 8, 10),
      { patrolTile: game.ref(coastX + 8, 10) },
    );

    game.addExecution(new CarrierExecution(player1, game.ref(coastX + 2, 10)));

    for (let i = 0; i < 15; i++) {
      game.executeNextTick();
    }

    expect(Number(enemyWarship.health())).toBe(1000);
  });

  test("does not attack allied ships", () => {
    game.config().carrierAircraftAttackRate = () => 1;

    const allianceRequest = player1.createAllianceRequest(player2);
    expect(allianceRequest).not.toBeNull();
    allianceRequest!.accept();

    const alliedWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 6, 10),
      { patrolTile: game.ref(coastX + 6, 10) },
    );

    game.addExecution(new CarrierExecution(player1, game.ref(coastX + 2, 10)));

    for (let i = 0; i < 15; i++) {
      game.executeNextTick();
    }

    expect(Number(alliedWarship.health())).toBe(1000);
  });

  test("aircraft fly in a straight line over land to reach their target", () => {
    const carrier = player1.buildUnit(
      UnitType.AircraftCarrier,
      game.ref(coastX + 1, 10),
      {},
    );
    const enemyWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 6, 10),
      { patrolTile: game.ref(coastX + 6, 10) },
    );

    // Spawn deep inside the land half: a water pathfinder could never route
    // from here, so reaching the target proves terrain-agnostic flight.
    game.addExecution(
      new AircraftExecution(game.ref(2, 10), player1, carrier, enemyWarship),
    );

    for (let i = 0; i < 10; i++) {
      game.executeNextTick();
    }

    expect(Number(enemyWarship.health())).toBe(800);
    expect(game.units(UnitType.Aircraft)).toHaveLength(0);
  });
});

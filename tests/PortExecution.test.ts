import { PortExecution } from "../src/core/execution/PortExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

let game: Game;
let player: Player;
let other: Player;

describe("PortExecution", () => {
  beforeEach(async () => {
    game = await setup("half_land_half_ocean", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
      new PlayerInfo("other", PlayerType.Human, null, "other_id"),
    ]);

    player = game.player("player_id");
    player.addGold(BigInt(1000000));
    other = game.player("other_id");

    game.config().structureMinDist = () => 10;
  });

  test("Destination ports chances scale with level", () => {
    game.config().proximityBonusPortsNb = () => 0;
    game.config().tradeShipShortRangeDebuff = () => 0;

    player.conquer(game.ref(7, 10));
    const spawn = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (spawn === false) {
      throw new Error("Unable to build port for test");
    }
    const port = player.buildUnit(UnitType.Port, spawn, {});
    const execution = new PortExecution(port);
    execution.init(game, 0);
    execution.tick(0);

    other.conquer(game.ref(0, 0));
    const otherPort = other.buildUnit(UnitType.Port, game.ref(0, 0), {});
    otherPort.increaseLevel();
    otherPort.increaseLevel();

    const ports = execution.tradingPorts();

    expect(ports.length).toBe(3);
  });

  test("Trade ship proximity bonus", () => {
    game.config().proximityBonusPortsNb = () => 10;
    game.config().tradeShipShortRangeDebuff = () => 0;

    player.conquer(game.ref(7, 10));
    const spawn = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (spawn === false) {
      throw new Error("Unable to build port for test");
    }
    const port = player.buildUnit(UnitType.Port, spawn, {});
    const execution = new PortExecution(port);
    execution.init(game, 0);
    execution.tick(0);

    other.conquer(game.ref(0, 0));
    other.buildUnit(UnitType.Port, game.ref(0, 0), {});

    const ports = execution.tradingPorts();

    expect(ports.length).toBe(2);
  });

  test("Trade ship short range debuff", () => {
    game.config().proximityBonusPortsNb = () => 10;
    // Short range debuff cancels out the proximity bonus.
    game.config().tradeShipShortRangeDebuff = () => 100;

    player.conquer(game.ref(7, 10));
    const spawn = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (spawn === false) {
      throw new Error("Unable to build port for test");
    }
    const port = player.buildUnit(UnitType.Port, spawn, {});
    const execution = new PortExecution(port);
    execution.init(game, 0);
    execution.tick(0);

    other.conquer(game.ref(0, 0));
    other.buildUnit(UnitType.Port, game.ref(0, 0), {});

    const ports = execution.tradingPorts();

    expect(ports.length).toBe(1);
  });

  test("nations select the route with the highest estimated income rate", async () => {
    game = await setup("half_land_half_ocean", { instantBuild: true }, [
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
      new PlayerInfo("partner", PlayerType.Human, null, "partner_id"),
    ]);
    const nation = game.player("nation_id");
    const partner = game.player("partner_id");
    nation.conquer(game.ref(7, 10));
    partner.conquer(game.ref(7, 11));
    const source = nation.buildUnit(UnitType.Port, game.ref(7, 10), {});
    const near = partner.buildUnit(UnitType.Port, game.ref(7, 11), {});
    const far = partner.buildUnit(UnitType.Port, game.ref(7, 14), {});
    game.config().proximityBonusPortsNb = () => 0;
    game.config().tradeShipShortRangeDebuff = () => 0;
    game.config().tradeShipGold = (distance) => BigInt(distance * distance);
    const execution = new PortExecution(source);
    execution.init(game, 0);

    const selected = execution.selectTradingPort(execution.tradingPorts());

    expect(selected).toBe(far);
    expect(selected).not.toBe(near);
  });

  test("naval batteries use shells while torpedoes remain submarine-only", () => {
    game.config().portNavalBatteryAttackRate = () => 0;
    player.conquer(game.ref(7, 10));
    const port = player.buildUnit(UnitType.Port, game.ref(7, 10), {});
    port.setPortSpecialization("naval");
    const enemyWarship = other.buildUnit(UnitType.Warship, game.ref(9, 10), {
      patrolTile: game.ref(9, 10),
    });
    const healthBefore = enemyWarship.health();

    game.addExecution(new PortExecution(port));
    for (let i = 0; i < 10; i++) {
      game.executeNextTick();
    }

    expect(enemyWarship.health()).toBeLessThan(healthBefore);
    expect(game.units(UnitType.Torpedo)).toHaveLength(0);
  });
});

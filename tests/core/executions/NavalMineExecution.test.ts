import { NavalMineExecution } from "../../../src/core/execution/NavalMineExecution";
import {
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
import { TileRef } from "../../../src/core/game/GameMap";
import { setup } from "../../util/Setup";
import { constructionExecution } from "../../util/utils";

const coastX = 7;

describe("NavalMineExecution", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("miner", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("enemy", PlayerType.Human, null, "player_2_id"),
      ],
    );

    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");

    const portTile = game.ref(coastX, 10);
    player1.conquer(portTile);
    player1.buildUnit(UnitType.Port, portTile, {});
  });

  test("is registered as a water buildable but not as a structure or disabled arsenal unit", () => {
    const info = game.config().unitInfo(UnitType.NavalMine);

    expect(UnitType.NavalMine).toBe("Naval Mine");
    expect(info.cost(game, player1)).toBe(0n);
    expect(info.constructionDuration).toBeUndefined();
    expect(game.config().navalMinePortRange()).toBe(120);
    expect(game.config().navalMineMaxPerPlayer()).toBe(12);
    expect(game.config().navalMineDetectionRange()).toBe(2);
    expect(game.config().navalMineBlastRange()).toBe(2);

    expect(DISABLED_ARSENAL).not.toContain(UnitType.NavalMine);
    expect(Structures.types).not.toContain(UnitType.NavalMine);
    expect(BuildMenus.types).toContain(UnitType.NavalMine);
    expect(PlayerBuildable.types).toContain(UnitType.NavalMine);
  });

  test("prices mines as escalating defensive fortifications", async () => {
    const normalGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [new PlayerInfo("miner", PlayerType.Human, null, "normal_miner")],
    );
    const normalPlayer = normalGame.player("normal_miner");
    const info = normalGame.config().unitInfo(UnitType.NavalMine);

    expect(info.cost(normalGame, normalPlayer)).toBe(50_000n);

    normalPlayer.buildUnit(
      UnitType.NavalMine,
      normalGame.ref(coastX + 2, 10),
      {},
    );

    expect(info.cost(normalGame, normalPlayer)).toBe(75_000n);
  });

  test("can be placed on water connected to an active port and constructed through the build path", () => {
    const mineTile = game.ref(coastX + 2, 10);

    expect(player1.canBuild(UnitType.NavalMine, mineTile)).toBe(mineTile);

    constructionExecution(game, player1, coastX + 2, 10, UnitType.NavalMine, 3);

    const mines = game.units(UnitType.NavalMine);
    expect(mines).toHaveLength(1);
    expect(mines[0]!.tile()).toBe(mineTile);
    expect(mines[0]!.isActive()).toBe(true);
  });

  test("rejects land, no-port, disconnected-water, and out-of-range placement", () => {
    const waterTile = game.ref(coastX + 2, 10);
    const landTile = game.ref(coastX - 1, 10);

    expect(player1.canBuild(UnitType.NavalMine, landTile)).toBe(false);

    const playerWithoutPort = game.player("player_2_id");
    playerWithoutPort.conquer(game.ref(coastX, 11));
    expect(playerWithoutPort.canBuild(UnitType.NavalMine, waterTile)).toBe(
      false,
    );

    vi.spyOn(game, "getWaterComponent").mockImplementation((tile: TileRef) =>
      tile === waterTile ? 1 : 2,
    );
    vi.spyOn(game, "hasWaterComponent").mockReturnValue(false);
    expect(player1.canBuild(UnitType.NavalMine, waterTile)).toBe(false);
    vi.restoreAllMocks();

    game.config().navalMinePortRange = () => 1;
    expect(player1.canBuild(UnitType.NavalMine, waterTile)).toBe(false);
  });

  test("enforces the per-player cap in canBuild and buildableUnits previews", () => {
    game.config().navalMineMaxPerPlayer = () => 1;
    const mineTile = game.ref(coastX + 2, 10);
    player1.buildUnit(UnitType.NavalMine, mineTile, {});

    expect(player1.canBuild(UnitType.NavalMine, game.ref(coastX + 3, 10))).toBe(
      false,
    );
    expect(
      player1
        .buildableUnits(game.ref(coastX + 3, 10))
        .find((unit) => unit.type === UnitType.NavalMine)?.canBuild,
    ).toBe(false);
  });

  test("detonates once against enemy warships and transports in blast range", () => {
    const mineTile = game.ref(coastX + 2, 10);
    const enemyWarship = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 3, 10),
      { patrolTile: game.ref(coastX + 3, 10) },
    );
    const enemyTransport = player2.buildUnit(
      UnitType.TransportShip,
      game.ref(coastX + 4, 10),
      { targetTile: game.ref(coastX + 4, 10) },
    );

    const execution = new NavalMineExecution(player1, mineTile);
    execution.init(game, game.ticks());
    execution.tick(game.ticks());

    expect(enemyWarship.isActive()).toBe(false);
    expect(enemyTransport.isActive()).toBe(false);
    expect(game.units(UnitType.NavalMine)).toHaveLength(0);
    expect(execution.isActive()).toBe(false);
  });

  test("does not detonate against own or allied ships", () => {
    const alliedRequest = player1.createAllianceRequest(player2);
    expect(alliedRequest).not.toBeNull();
    alliedRequest!.accept();

    const mineTile = game.ref(coastX + 2, 10);
    const ownWarship = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 3, 10),
      { patrolTile: game.ref(coastX + 3, 10) },
    );
    const alliedTransport = player2.buildUnit(
      UnitType.TransportShip,
      game.ref(coastX + 4, 10),
      { targetTile: game.ref(coastX + 4, 10) },
    );

    const execution = new NavalMineExecution(player1, mineTile);
    execution.init(game, game.ticks());
    execution.tick(game.ticks());

    expect(ownWarship.isActive()).toBe(true);
    expect(alliedTransport.isActive()).toBe(true);
    expect(game.units(UnitType.NavalMine)).toHaveLength(1);
    expect(execution.isActive()).toBe(true);
  });

  test("does not trigger on enemy trade ships in v1", () => {
    const mineTile = game.ref(coastX + 2, 10);
    const enemyPort = player2.buildUnit(
      UnitType.Port,
      game.ref(coastX, 11),
      {},
    );
    const tradeShip = player2.buildUnit(
      UnitType.TradeShip,
      game.ref(coastX + 3, 11),
      { targetUnit: enemyPort },
    );

    const execution = new NavalMineExecution(player1, mineTile);
    execution.init(game, game.ticks());
    execution.tick(game.ticks());

    expect(tradeShip.isActive()).toBe(true);
    expect(game.units(UnitType.NavalMine)).toHaveLength(1);
    expect(execution.isActive()).toBe(true);
  });
});

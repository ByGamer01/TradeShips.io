import { AircraftExecution } from "../../../src/core/execution/AircraftExecution";
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

function antiAirFrigateType(): UnitType {
  const type = (UnitType as Record<string, UnitType>).AntiAirFrigate;
  expect(type).toBe("Anti-Air Frigate");
  return type;
}

describe("AntiAirFrigateExecution", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("escort", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("carrier", PlayerType.Human, null, "player_2_id"),
      ],
    );

    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");

    const portTile = game.ref(coastX, 10);
    player1.conquer(portTile);
    player1.buildUnit(UnitType.Port, portTile, {});
  });

  test("is registered as a naval buildable with anti-air config", async () => {
    const type = antiAirFrigateType();
    const info = game.config().unitInfo(type);
    const normalGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [new PlayerInfo("escort", PlayerType.Human, null, "normal_escort")],
    );
    const normalPlayer = normalGame.player("normal_escort");
    const normalInfo = normalGame.config().unitInfo(type);

    expect(info.maxHealth).toBe(800);
    expect(normalInfo.cost(normalGame, normalPlayer)).toBe(300_000n);
    expect((game.config() as any).antiAirFrigateRange()).toBe(25);
    expect((game.config() as any).antiAirFrigateAttackRate()).toBe(5);

    expect(DISABLED_ARSENAL).not.toContain(type);
    expect(Structures.types).not.toContain(type);
    expect(BuildableAttacks.types).toContain(type);
    expect(BuildMenus.types).toContain(type);
    expect(PlayerBuildable.types).toContain(type);
  });

  test("spawns from the nearest connected port like other naval warships", () => {
    const type = antiAirFrigateType();
    const portTile = game.ref(coastX, 10);

    expect(player1.canBuild(type, game.ref(coastX + 3, 10))).toBe(portTile);

    constructionExecution(game, player1, coastX + 3, 10, type, 3);

    const frigates = game.units(type);
    expect(frigates).toHaveLength(1);
    expect(frigates[0]!.isActive()).toBe(true);
    expect(frigates[0]!.warshipState().patrolTile).toBe(
      game.ref(coastX + 3, 10),
    );
  });

  test("intercepts enemy carrier aircraft before they strike nearby ships", async () => {
    const type = antiAirFrigateType();
    const { AntiAirFrigateExecution } = await import(
      "../../../src/core/execution/AntiAirFrigateExecution"
    );
    game.config().aircraftStepsPerTick = () => 0;
    (game.config() as any).antiAirFrigateAttackRate = () => 0;

    const frigate = player1.buildUnit(type, game.ref(coastX + 2, 10), {
      patrolTile: game.ref(coastX + 2, 10),
    } as any);
    const carrier = player2.buildUnit(
      UnitType.AircraftCarrier,
      game.ref(coastX + 3, 10),
      {},
    );
    const protectedWarship = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 6, 10),
      { patrolTile: game.ref(coastX + 6, 10) },
    );

    game.addExecution(new AntiAirFrigateExecution(frigate));
    game.addExecution(
      new AircraftExecution(
        game.ref(coastX + 3, 10),
        player2,
        carrier,
        protectedWarship,
      ),
    );

    for (let i = 0; i < 3; i++) {
      game.executeNextTick();
    }

    expect(game.units(UnitType.Aircraft)).toHaveLength(0);
    expect(Number(protectedWarship.health())).toBe(1000);
  });
});

import { EconomicMissionExecution } from "../../../src/core/execution/EconomicMissionExecution";
import {
  Game,
  MessageType,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

const coastX = 7;

describe("EconomicMissionExecution", () => {
  let game: Game;
  let trader: Player;
  let landlocked: Player;
  let mission: EconomicMissionExecution;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("trader", PlayerType.Human, null, "trader_id"),
        new PlayerInfo("landlocked", PlayerType.Human, null, "landlocked_id"),
      ],
    );

    trader = game.player("trader_id");
    landlocked = game.player("landlocked_id");

    const portTile = game.ref(coastX, 10);
    trader.conquer(portTile);
    trader.buildUnit(UnitType.Port, portTile, {});

    game.displayMessage = vi.fn();
    mission = new EconomicMissionExecution();
    mission.init(game, 0);
  });

  it("does nothing on the very first tick", () => {
    mission.tick(0);
    expect(game.displayMessage).not.toHaveBeenCalled();
  });

  it("does nothing before the mission interval elapses", () => {
    mission.tick(EconomicMissionExecution.MISSION_INTERVAL_TICKS - 1);
    expect(game.displayMessage).not.toHaveBeenCalled();
    expect(trader.gold()).toBe(0n);
  });

  it("rewards players with an active port and announces globally", () => {
    const goldBefore = trader.gold();
    mission.tick(EconomicMissionExecution.MISSION_INTERVAL_TICKS);

    expect(trader.gold()).toBe(
      goldBefore + EconomicMissionExecution.GOLD_BONUS_PER_PORT,
    );
    expect(game.displayMessage).toHaveBeenCalledWith(
      "events_display.economic_mission_started",
      MessageType.ECONOMIC_MISSION_STARTED,
      null,
      undefined,
      { count: 1 },
    );
  });

  it("does not reward players without an active port", () => {
    const goldBefore = landlocked.gold();
    mission.tick(EconomicMissionExecution.MISSION_INTERVAL_TICKS);
    expect(landlocked.gold()).toBe(goldBefore);
  });

  it("does not announce anything when no player has an active port", async () => {
    const emptyGame = await setup("half_land_half_ocean", {
      infiniteGold: true,
      instantBuild: true,
    });
    emptyGame.displayMessage = vi.fn();
    const emptyMission = new EconomicMissionExecution();
    emptyMission.init(emptyGame, 0);
    emptyMission.tick(EconomicMissionExecution.MISSION_INTERVAL_TICKS);
    expect(emptyGame.displayMessage).not.toHaveBeenCalled();
  });

  it("is not active during the spawn phase", () => {
    expect(mission.activeDuringSpawnPhase()).toBe(false);
  });

  it("stays active for the whole game", () => {
    mission.tick(EconomicMissionExecution.MISSION_INTERVAL_TICKS);
    expect(mission.isActive()).toBe(true);
  });
});

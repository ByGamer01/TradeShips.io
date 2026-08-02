import { CarrierExecution } from "../../../src/core/execution/CarrierExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { GameUpdateType } from "../../../src/core/game/GameUpdates";
import { unitAtlasColumnForType } from "../../../src/client/render/gl/passes/UnitPass";
import { setup } from "../../util/Setup";

const coastX = 7;

describe("Aircraft wire → renderer contract (scratch)", () => {
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

  test("aircraft emit Unit updates whose type maps to an atlas column", () => {
    game.config().carrierAircraftAttackRate = () => 1;
    player2.buildUnit(UnitType.Warship, game.ref(coastX + 6, 10), {
      patrolTile: game.ref(coastX + 6, 10),
    });
    game.addExecution(new CarrierExecution(player1, game.ref(coastX + 2, 10)));

    const seenTypes = new Set<string>();
    let aircraftUpdates = 0;
    for (let i = 0; i < 25; i++) {
      const updates = game.executeNextTick();
      for (const u of updates[GameUpdateType.Unit]) {
        seenTypes.add(u.unitType);
        if (u.unitType === UnitType.Aircraft) aircraftUpdates++;
      }
    }

    // 1. The sim broadcasts aircraft over the wire.
    expect(aircraftUpdates).toBeGreaterThan(0);
    // 2. The exact wire string resolves to a renderable atlas column.
    expect(unitAtlasColumnForType(UnitType.Aircraft)).toBeGreaterThanOrEqual(0);
    console.log("unit types on wire:", [...seenTypes]);
    console.log("aircraft updates:", aircraftUpdates);
    console.log("aircraft atlas col:", unitAtlasColumnForType(UnitType.Aircraft));
  });
});

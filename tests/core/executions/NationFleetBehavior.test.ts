import { describe, expect, it, vi } from "vitest";
import { ConstructionExecution } from "../../../src/core/execution/ConstructionExecution";
import { NationFleetBehavior } from "../../../src/core/execution/nation/NationFleetBehavior";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { PseudoRandom } from "../../../src/core/PseudoRandom";
import { setup } from "../../util/Setup";

async function navalGame(): Promise<{
  game: Game;
  nation: Player;
  rival: Player;
}> {
  const game = await setup("half_land_half_ocean");
  const nation = game.addPlayer(
    new PlayerInfo("nation", PlayerType.Nation, null, "nation"),
  );
  const rival = game.addPlayer(
    new PlayerInfo("rival", PlayerType.Human, null, "rival"),
  );
  for (let x = 0; x < 7; x++) {
    for (let y = 0; y < 16; y++) {
      const tile = game.ref(x, y);
      if (game.isLand(tile) && !game.hasOwner(tile)) nation.conquer(tile);
    }
  }
  nation.buildUnit(UnitType.Port, game.ref(6, 4), {});
  nation.addGold(10_000_000n);
  game.setMaritimeZone({
    center: () => game.ref(12, 8),
    contains: (tile) => tile === game.ref(12, 8),
    randomPatrolTile: () => game.ref(12, 8),
  });
  return { game, nation, rival };
}

function queuedType(spy: ReturnType<typeof vi.spyOn>): UnitType {
  const execution = spy.mock.calls[0][0] as ConstructionExecution;
  return (execution as unknown as { constructionType: UnitType })
    .constructionType;
}

describe("NationFleetBehavior", () => {
  it("builds submarines to raid and contest maritime objectives", async () => {
    const { game, nation } = await navalGame();
    const addExecution = vi.spyOn(game, "addExecution");
    const behavior = new NationFleetBehavior(new PseudoRandom(1), game, nation);

    expect(behavior.buildStrategicFleet()).toBe(true);
    expect(queuedType(addExecution)).toBe(UnitType.Submarine);
  });

  it("prioritizes anti-air frigates against carriers", async () => {
    const { game, nation, rival } = await navalGame();
    const target = game.ref(12, 8);
    rival.buildUnit(UnitType.AircraftCarrier, target, {});
    const addExecution = vi.spyOn(game, "addExecution");
    const behavior = new NationFleetBehavior(new PseudoRandom(2), game, nation);

    expect(behavior.buildStrategicFleet()).toBe(true);
    expect(queuedType(addExecution)).toBe(UnitType.AntiAirFrigate);
  });

  it("lays naval mines when enemy submarines threaten its waters", async () => {
    const { game, nation, rival } = await navalGame();
    rival.buildUnit(UnitType.Submarine, game.ref(12, 8), {});
    const addExecution = vi.spyOn(game, "addExecution");
    const behavior = new NationFleetBehavior(new PseudoRandom(3), game, nation);

    expect(behavior.buildStrategicFleet()).toBe(true);
    expect(queuedType(addExecution)).toBe(UnitType.NavalMine);
  });

  it("does not expand its fleet while indebted", async () => {
    const { game, nation } = await navalGame();
    nation.addDebt(1n);
    const addExecution = vi.spyOn(game, "addExecution");
    const behavior = new NationFleetBehavior(new PseudoRandom(4), game, nation);

    expect(behavior.buildStrategicFleet()).toBe(false);
    expect(addExecution).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { ConstructionExecution } from "../../../src/core/execution/ConstructionExecution";
import { NationEconomicBehavior } from "../../../src/core/execution/nation/NationEconomicBehavior";
import { TariffExecution } from "../../../src/core/execution/TariffExecution";
import { PlayerInfo, PlayerType, UnitType } from "../../../src/core/game/Game";
import { PseudoRandom } from "../../../src/core/PseudoRandom";
import { setup } from "../../util/Setup";

describe("NationEconomicBehavior", () => {
  it("builds a congress before trying to tariff a rival", async () => {
    const game = await setup("plains");
    const nation = game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation"),
    );
    const rival = game.addPlayer(
      new PlayerInfo("rival", PlayerType.Human, null, "rival"),
    );
    nation.conquer(game.ref(1, 1));
    rival.conquer(game.ref(2, 2));
    nation.addGold(2_000_000n);
    const addExecution = vi.spyOn(game, "addExecution");
    const behavior = new NationEconomicBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );

    expect(behavior.manageEconomy()).toBe(true);
    expect(addExecution.mock.calls[0][0]).toBeInstanceOf(ConstructionExecution);
  });

  it("uses an active congress to tariff the richest eligible rival", async () => {
    const game = await setup("plains");
    const nation = game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation"),
    );
    const rival = game.addPlayer(
      new PlayerInfo("rival", PlayerType.Human, null, "rival"),
    );
    nation.conquer(game.ref(1, 1));
    rival.conquer(game.ref(2, 2));
    nation.addGold(2_000_000n);
    rival.addGold(5_000_000n);
    nation.buildUnit(UnitType.Congress, game.ref(1, 1), {});
    const addExecution = vi.spyOn(game, "addExecution");
    const behavior = new NationEconomicBehavior(
      new PseudoRandom(2),
      game,
      nation,
    );

    expect(behavior.manageEconomy()).toBe(true);
    expect(addExecution.mock.calls[0][0]).toBeInstanceOf(TariffExecution);
  });
});

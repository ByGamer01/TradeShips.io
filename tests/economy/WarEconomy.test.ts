import { beforeEach, describe, expect, it } from "vitest";
import { Game, Player, PlayerType } from "../../src/core/game/Game";
import { playerInfo, setup } from "../util/Setup";

describe("war economy", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup("plains", {}, [
      playerInfo("attacker", PlayerType.Human),
    ]);
    player = game.player("attacker");
    player.addGold(10_000_000n);
  });

  it("increases sustained attack costs and caps exhaustion", () => {
    const firstCost = player.updateWarEconomy(1, 100n);
    let finalCost = 0n;

    for (let tick = 1; tick < 1_800; tick++) {
      finalCost = player.updateWarEconomy(1, 100n);
    }

    expect(firstCost).toBe(25n);
    expect(finalCost).toBe(200n);
    expect(player.warExhaustion()).toBeCloseTo(1);
  });

  it("recovers exhaustion while no attacks are active", () => {
    for (let tick = 0; tick < 900; tick++) {
      player.updateWarEconomy(1, 100n);
    }

    for (let tick = 0; tick < 450; tick++) {
      player.updateWarEconomy(0, 100n);
    }

    expect(player.warExhaustion()).toBeCloseTo(0, 5);
  });

  it("returns a bounded recovery grant after victory", () => {
    for (let tick = 0; tick < 1_800; tick++) {
      player.updateWarEconomy(4, 100_000n);
    }

    expect(player.collectWarRecoveryReward()).toBe(2_000_000n);
    expect(player.warExhaustion()).toBeCloseTo(0.5);
    expect(player.collectWarRecoveryReward()).toBe(0n);
  });
});

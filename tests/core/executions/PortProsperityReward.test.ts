import { UpgradeStructureExecution } from "../../../src/core/execution/UpgradeStructureExecution";
import { PlayerInfo, PlayerType, UnitType } from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

describe("port prosperity reward", () => {
  it("forgives debt and awards 100M when a port passes level 500", async () => {
    const game = await setup("half_land_half_ocean", { instantBuild: true });
    const player = game.addPlayer(
      new PlayerInfo("trader", PlayerType.Human, null, "trader"),
    );
    const tile = game.ref(7, 10);
    player.conquer(tile);
    const port = player.buildUnit(UnitType.Port, tile, {});
    for (let level = port.level(); level < 500; level++) {
      port.increaseLevel();
    }
    player.addDebt(25_000_000n);
    const upgradeCost = game.unitInfo(UnitType.Port).cost(game, player);
    player.addGold(upgradeCost);

    const execution = new UpgradeStructureExecution(player, port.id());
    execution.init(game, game.ticks());

    expect(port.level()).toBe(501);
    expect(player.debt()).toBe(0n);
    expect(player.isBankrupt()).toBe(false);
    expect(player.gold()).toBe(game.config().portProsperityGoldReward());

    player.addDebt(1_000_000n);
    const nextUpgradeCost = game.unitInfo(UnitType.Port).cost(game, player);
    const goldBeforeNextUpgrade = player.gold();
    new UpgradeStructureExecution(player, port.id()).init(game, game.ticks());

    expect(port.level()).toBe(502);
    expect(player.debt()).toBe(1_000_000n);
    expect(player.gold()).toBe(goldBeforeNextUpgrade - nextUpgradeCost);
  });
});

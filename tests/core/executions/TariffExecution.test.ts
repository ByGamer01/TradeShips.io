import { describe, expect, it } from "vitest";
import { TariffExecution } from "../../../src/core/execution/TariffExecution";
import {
  ColoredTeams,
  Game,
  GameMode,
  Player,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { playerInfo, setup } from "../../util/Setup";

function runTariff(game: Game, buyer: Player, target: Player): void {
  const exec = new TariffExecution(buyer, target.id());
  exec.init(game, game.ticks());
  exec.tick(game.ticks());
  expect(exec.isActive()).toBe(false);
}

function buildCongress(game: Game, player: Player): void {
  let congressTile: number | null = null;
  game.forEachTile((tile) => {
    if (
      congressTile === null &&
      game.isLand(tile) &&
      !game.isImpassable(tile)
    ) {
      congressTile = tile;
    }
  });
  if (congressTile === null) {
    throw new Error("test map has no land tile for Congress");
  }
  player.conquer(congressTile);
  player.buildUnit(UnitType.Congress, congressTile, {});
}

describe("TariffExecution", () => {
  it("does not impose tariffs without an active Congress", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const buyer = game.addPlayer(playerInfo("buyer", PlayerType.Human));
    const target = game.addPlayer(playerInfo("target", PlayerType.Human));
    const cost = game.config().tariffCost();
    buyer.addGold(cost);
    const before = buyer.gold();

    runTariff(game, buyer, target);

    expect(buyer.gold()).toBe(before);
    expect(buyer.hasTariffAgainst(target)).toBe(false);
  });

  it("charges gold and registers a tariff against the target", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const buyer = game.addPlayer(playerInfo("buyer", PlayerType.Human));
    const target = game.addPlayer(playerInfo("target", PlayerType.Human));
    buildCongress(game, buyer);
    const cost = game.config().tariffCost();
    buyer.addGold(cost);
    const before = buyer.gold();

    runTariff(game, buyer, target);

    expect(buyer.gold()).toBe(before - cost);
    expect(buyer.hasTariffAgainst(target)).toBe(true);
    expect(target.hasTariffAgainst(buyer)).toBe(false);
  });

  it("does nothing when the buyer cannot afford the tariff", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const buyer = game.addPlayer(playerInfo("buyer", PlayerType.Human));
    const target = game.addPlayer(playerInfo("target", PlayerType.Human));
    const before = buyer.gold();

    runTariff(game, buyer, target);

    expect(buyer.gold()).toBe(before);
    expect(buyer.hasTariffAgainst(target)).toBe(false);
  });

  it("does not allow tariffs against teammates", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.Team,
      playerTeams: 2,
    });
    const buyer = (game as any).addPlayer(
      playerInfo("buyer", PlayerType.Human),
      ColoredTeams.Red,
    ) as Player;
    const teammate = (game as any).addPlayer(
      playerInfo("teammate", PlayerType.Human),
      ColoredTeams.Red,
    ) as Player;
    buyer.addGold(game.config().tariffCost());

    runTariff(game, buyer, teammate);

    expect(buyer.hasTariffAgainst(teammate)).toBe(false);
  });

  it("expires after the configured duration", async () => {
    const game = await setup("half_land_half_ocean", {
      gameMode: GameMode.FFA,
    });
    const buyer = game.addPlayer(playerInfo("buyer", PlayerType.Human));
    const target = game.addPlayer(playerInfo("target", PlayerType.Human));
    buildCongress(game, buyer);
    buyer.addGold(game.config().tariffCost());

    runTariff(game, buyer, target);
    expect(buyer.hasTariffAgainst(target)).toBe(true);

    const duration = game.config().tariffDurationTicks();
    for (let i = 0; i <= duration; i++) {
      game.executeNextTick();
    }

    expect(buyer.hasTariffAgainst(target)).toBe(false);
  });
});

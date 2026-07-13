import { beforeEach, describe, expect, it } from "vitest";
import { AllianceRequestExecution } from "../src/core/execution/alliance/AllianceRequestExecution";
import { Executor } from "../src/core/execution/ExecutionManager";
import { Game, Player, PlayerType } from "../src/core/game/Game";
import { GameRunner } from "../src/core/GameRunner";
import { playerInfo, setup } from "./util/Setup";

describe("gold requests", () => {
  let game: Game;
  let requester: Player;
  let donor: Player;
  let runner: GameRunner;

  beforeEach(async () => {
    game = await setup("plains", { donateGold: true }, [
      playerInfo("requester", PlayerType.Human),
      playerInfo("donor", PlayerType.Human),
    ]);
    requester = game.player("requester");
    donor = game.player("donor");
    requester.conquer(game.ref(0, 0));
    donor.conquer(game.ref(0, 1));

    game.addExecution(
      new AllianceRequestExecution(requester, donor.id()),
      new AllianceRequestExecution(donor, requester.id()),
    );
    game.executeNextTick();

    runner = new GameRunner(
      game,
      new Executor(game, "gold-request-test", undefined),
      () => {},
    );
  });

  it("allows eligible allies to ask for gold", () => {
    const actions = runner.playerActions(requester.id(), 0, 1);

    expect(actions.interaction?.canRequestGold).toBe(true);
  });

  it("honors the existing quick-chat cooldown", () => {
    requester.recordQuickChat(donor);
    const actions = runner.playerActions(requester.id(), 0, 1);

    expect(actions.interaction?.canRequestGold).toBe(false);
  });
});

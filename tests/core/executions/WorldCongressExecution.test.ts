import { describe, expect, it } from "vitest";
import { CongressResolveExecution } from "../../../src/core/execution/CongressResolveExecution";
import { CongressStartExecution } from "../../../src/core/execution/CongressStartExecution";
import {
  Game,
  GameMode,
  Player,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import {
  getCongressState,
  isCongressResolutionActive,
  selectCongressWinner,
} from "../../../src/core/game/WorldCongress";
import { playerInfo, setup } from "../../util/Setup";

async function congressGame(playerCount = 2): Promise<{
  game: Game;
  players: Player[];
}> {
  const humans = Array.from({ length: playerCount }, (_, index) =>
    playerInfo(`player-${index}`, PlayerType.Human),
  );
  const game = await setup(
    "big_plains",
    { gameMode: GameMode.WorldCongress },
    humans,
  );
  const players = game.allPlayers();
  const land = new Array<number>();
  game.forEachTile((tile) => {
    if (game.isLand(tile) && !game.isImpassable(tile)) land.push(tile);
  });
  let cursor = 0;
  players.forEach((player, index) => {
    for (let i = 0; i <= index; i++) player.conquer(land[cursor++]);
  });
  return { game, players };
}

function start(game: Game, session: number): void {
  new CongressStartExecution(session, Date.now() + 60_000).init(game);
}

function resolve(game: Game, session: number, proposalIndex: number): void {
  new CongressResolveExecution(session, proposalIndex, [0, 0, 0]).init(game);
}

describe("World Congress executions", () => {
  it("requires half of eligible voters for a targeted resolution", () => {
    expect(selectCongressWinner(2, [2, 1, 1], 6)).toBe(1);
    expect(selectCongressWinner(2, [3, 1, 1], 6)).toBe(0);
  });

  it("opens a voting session and targets the largest active player", async () => {
    const { game, players } = await congressGame(3);

    start(game, 2);

    const state = getCongressState(game);
    expect(game.isPaused()).toBe(true);
    expect(state.proposals).toHaveLength(3);
    expect(state.proposals[0]).toMatchObject({
      type: "embargo_player",
      targetSmallID: players[2].smallID(),
    });
  });

  it("activates infrastructure subsidies and resumes the game", async () => {
    const { game, players } = await congressGame();
    const baseCost = game.unitInfo(UnitType.Port).cost(game, players[0]);
    start(game, 1);

    resolve(game, 1, 1);

    expect(game.isPaused()).toBe(false);
    expect(isCongressResolutionActive(game, "infrastructure_subsidy")).toBe(
      true,
    );
    expect(game.unitInfo(UnitType.Port).cost(game, players[0])).toBe(
      baseCost / 2n,
    );
  });

  it("blocks nuclear construction while non-proliferation is active", async () => {
    const { game, players } = await congressGame();
    start(game, 1);
    resolve(game, 1, 2);
    players[0].addGold(10_000_000n);

    const atomBomb = players[0].buildableUnits(null, [UnitType.AtomBomb])[0];

    expect(atomBomb.canBuild).toBe(false);
  });

  it("collects five percent and redistributes the fund to smaller players", async () => {
    const { game, players } = await congressGame(6);
    for (const player of players) player.addGold(1_000n);
    start(game, 1);

    resolve(game, 1, 0);

    expect(players[5].gold()).toBe(950n);
    for (const recipient of players.slice(0, 5)) {
      expect(recipient.gold()).toBe(1_010n);
    }
  });
});

import { Execution, Game, GameMode } from "../game/Game";
import { GameUpdateType } from "../game/GameUpdates";
import {
  createCongressProposals,
  getCongressState,
} from "../game/WorldCongress";

export class CongressStartExecution implements Execution {
  private active = true;

  constructor(
    private readonly session: number,
    private readonly endsAt: number,
  ) {}

  init(game: Game): void {
    if (game.config().gameConfig().gameMode !== GameMode.WorldCongress) {
      this.active = false;
      return;
    }

    const state = getCongressState(game);
    if (this.session <= state.session) {
      this.active = false;
      return;
    }

    state.session = this.session;
    state.proposals = createCongressProposals(game, this.session);
    game.setPaused(true);
    game.addUpdate({
      type: GameUpdateType.WorldCongress,
      phase: "voting",
      session: this.session,
      proposals: state.proposals,
      endsAt: this.endsAt,
    });
    this.active = false;
  }

  tick(): void {}

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

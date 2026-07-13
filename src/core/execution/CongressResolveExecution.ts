import { Execution, Game, GameMode, Player } from "../game/Game";
import { GameUpdateType } from "../game/GameUpdates";
import {
  activateCongressResolution,
  ActiveCongressResolution,
  activeHumanPlayers,
  CONGRESS_RESOLUTION_DURATION_TICKS,
  getCongressState,
} from "../game/WorldCongress";

export class CongressResolveExecution implements Execution {
  private active = true;
  private game!: Game;
  private embargoTarget?: Player;
  private congressEmbargoes: Player[] = [];
  private expiresAt?: number;

  constructor(
    private readonly session: number,
    private readonly proposalIndex: number,
    private readonly voteCounts: number[],
  ) {}

  init(game: Game): void {
    this.game = game;
    if (game.config().gameConfig().gameMode !== GameMode.WorldCongress) {
      this.active = false;
      return;
    }

    const state = getCongressState(game);
    const proposal = state.proposals[this.proposalIndex];
    if (state.session !== this.session || proposal === undefined) {
      this.active = false;
      return;
    }

    game.setPaused(false);
    const temporary =
      proposal.type !== "condemn_player" &&
      proposal.type !== "international_development_fund";
    const resolution: ActiveCongressResolution = {
      ...proposal,
      session: this.session,
      expiresAt: temporary
        ? game.ticks() + CONGRESS_RESOLUTION_DURATION_TICKS
        : undefined,
    };

    this.applyResolution(resolution);
    if (temporary) {
      activateCongressResolution(game, resolution);
      this.expiresAt = resolution.expiresAt;
    } else {
      this.active = false;
    }

    game.addUpdate({
      type: GameUpdateType.WorldCongress,
      phase: "resolved",
      session: this.session,
      proposals: state.proposals,
      winningProposalIndex: this.proposalIndex,
      voteCounts: this.voteCounts,
      activeResolution: resolution,
    });
  }

  private applyResolution(resolution: ActiveCongressResolution): void {
    switch (resolution.type) {
      case "condemn_player": {
        const target = this.targetPlayer(resolution.targetSmallID);
        if (target !== undefined) {
          target.removeAllAlliances();
          target.markTraitor();
        }
        break;
      }
      case "embargo_player": {
        const target = this.targetPlayer(resolution.targetSmallID);
        if (target === undefined) break;
        this.embargoTarget = target;
        for (const other of activeHumanPlayers(this.game)) {
          if (other === target || target.hasEmbargoAgainst(other)) continue;
          target.addEmbargo(other, true);
          this.congressEmbargoes.push(other);
        }
        break;
      }
      case "international_development_fund":
        this.distributeDevelopmentFund();
        break;
      case "nuclear_non_proliferation":
      case "infrastructure_subsidy":
      case "infrastructure_tax":
      case "open_seas":
        break;
    }
  }

  private targetPlayer(smallID: number | undefined): Player | undefined {
    if (smallID === undefined) return undefined;
    const player = this.game.playerBySmallID(smallID);
    return player.isPlayer() ? player : undefined;
  }

  private distributeDevelopmentFund(): void {
    const players = activeHumanPlayers(this.game);
    if (players.length === 0) return;

    let fund = 0n;
    for (const player of players) {
      fund += player.removeGold(player.gold() / 20n);
    }

    const recipients = players
      .sort(
        (a, b) =>
          a.numTilesOwned() - b.numTilesOwned() || a.smallID() - b.smallID(),
      )
      .slice(0, 5);
    const share = fund / BigInt(recipients.length);
    for (const recipient of recipients) recipient.addGold(share);
  }

  tick(ticks: number): void {
    if (this.expiresAt === undefined || ticks < this.expiresAt) return;
    if (this.embargoTarget !== undefined) {
      for (const other of this.congressEmbargoes) {
        this.embargoTarget.endTemporaryEmbargo(other);
      }
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

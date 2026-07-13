import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { GameMode, UnitType } from "../../../core/game/Game";
import {
  GameUpdateType,
  WorldCongressUpdate,
} from "../../../core/game/GameUpdates";
import { CongressProposal } from "../../../core/game/WorldCongress";
import { Controller } from "../../Controller";
import { SendCongressVoteIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";

@customElement("world-congress-panel")
export class WorldCongressPanel extends LitElement implements Controller {
  public game?: GameView;
  public eventBus?: EventBus;

  @state() private congressUpdate?: WorldCongressUpdate;
  @state() private selectedProposal?: number;
  @state() private secondsRemaining = 0;
  @state() private resultVisibleUntil = 0;

  createRenderRoot() {
    return this;
  }

  tick(): void {
    if (this.game?.config().gameConfig().gameMode !== GameMode.WorldCongress) {
      return;
    }

    const updates = this.game.updatesSinceLastTick()?.[
      GameUpdateType.WorldCongress
    ] as WorldCongressUpdate[] | undefined;
    if (updates?.length) {
      this.congressUpdate = updates[updates.length - 1];
      if (this.congressUpdate.phase === "voting") {
        this.selectedProposal = undefined;
      } else {
        this.resultVisibleUntil = Date.now() + 8_000;
      }
    }

    this.secondsRemaining =
      this.congressUpdate?.phase === "voting" &&
      this.congressUpdate.endsAt !== undefined
        ? Math.max(
            0,
            Math.ceil((this.congressUpdate.endsAt - Date.now()) / 1000),
          )
        : 0;
    this.requestUpdate();
  }

  private vote(index: number): void {
    if (this.congressUpdate?.phase !== "voting") return;
    this.selectedProposal = index;
    this.eventBus?.emit(
      new SendCongressVoteIntentEvent(this.congressUpdate.session, index),
    );
  }

  private playerName(smallID: number | undefined): string {
    if (smallID === undefined || this.game === undefined) return "";
    const player = this.game.playerBySmallID(smallID);
    return player.isPlayer() ? player.displayName() : "";
  }

  private infrastructureName(type: UnitType | undefined): string {
    switch (type) {
      case UnitType.Port:
        return translateText("unit_type.port");
      case UnitType.City:
        return translateText("unit_type.city");
      case UnitType.Factory:
        return translateText("unit_type.factory");
      default:
        return "";
    }
  }

  private proposalText(proposal: CongressProposal): {
    title: string;
    description: string;
  } {
    const params = {
      player: this.playerName(proposal.targetSmallID),
      infrastructure: this.infrastructureName(proposal.infrastructureType),
    };
    return {
      title: translateText(`world_congress.${proposal.type}.title`, params),
      description: translateText(
        `world_congress.${proposal.type}.description`,
        params,
      ),
    };
  }

  private renderVoting() {
    if (this.congressUpdate?.phase !== "voting") return nothing;
    return html`
      <div
        class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-3 py-6 pointer-events-auto"
      >
        <section
          class="w-full max-w-4xl overflow-hidden rounded-sm border border-amber-300/35 bg-slate-950 text-white shadow-2xl"
          aria-modal="true"
          role="dialog"
          aria-labelledby="congress-title"
        >
          <header
            class="flex items-end justify-between gap-4 border-b border-amber-300/25 bg-amber-100/[0.04] px-5 py-4 sm:px-8"
          >
            <div>
              <p
                class="mb-1 text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/70"
              >
                ${translateText("world_congress.session", {
                  session: this.congressUpdate.session,
                })}
              </p>
              <h2
                id="congress-title"
                class="text-2xl font-black uppercase tracking-wide sm:text-3xl"
              >
                ${translateText("world_congress.title")}
              </h2>
            </div>
            <div class="min-w-20 border-l border-amber-300/25 pl-4 text-right">
              <div
                class="font-mono text-3xl font-bold tabular-nums text-amber-300"
              >
                ${this.secondsRemaining}
              </div>
              <div class="text-[10px] uppercase tracking-[0.2em] text-white/45">
                ${translateText("world_congress.seconds")}
              </div>
            </div>
          </header>

          <div class="grid gap-px bg-white/10 sm:grid-cols-3">
            ${this.congressUpdate.proposals.map((proposal, index) => {
              const text = this.proposalText(proposal);
              const selected = this.selectedProposal === index;
              return html`
                <button
                  class="group min-h-64 bg-slate-950 p-5 text-left transition-colors hover:bg-amber-200/[0.07] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 ${selected
                    ? "bg-amber-200/[0.11]"
                    : ""}"
                  aria-pressed=${selected}
                  @click=${() => this.vote(index)}
                >
                  <div class="mb-8 flex items-center justify-between">
                    <span class="font-mono text-xs text-white/35"
                      >0${index + 1}</span
                    >
                    <span
                      class="grid h-6 w-6 place-items-center rounded-full border ${selected
                        ? "border-amber-300 bg-amber-300 text-slate-950"
                        : "border-white/25 text-transparent"}"
                      >✓</span
                    >
                  </div>
                  <h3
                    class="mb-3 text-lg font-extrabold uppercase leading-tight tracking-wide text-amber-100"
                  >
                    ${text.title}
                  </h3>
                  <p class="text-sm leading-6 text-white/60">
                    ${text.description}
                  </p>
                  <p
                    class="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] ${selected
                      ? "text-amber-300"
                      : "text-white/30 group-hover:text-amber-300/70"}"
                  >
                    ${selected
                      ? translateText("world_congress.vote_recorded")
                      : translateText("world_congress.cast_vote")}
                  </p>
                </button>
              `;
            })}
          </div>
        </section>
      </div>
    `;
  }

  private renderResult() {
    if (
      this.congressUpdate?.phase !== "resolved" ||
      Date.now() >= this.resultVisibleUntil ||
      this.congressUpdate.winningProposalIndex === undefined
    ) {
      return nothing;
    }
    const text = this.proposalText(
      this.congressUpdate.proposals[this.congressUpdate.winningProposalIndex],
    );
    const votes =
      this.congressUpdate.voteCounts?.[
        this.congressUpdate.winningProposalIndex
      ] ?? 0;
    return html`
      <aside
        class="fixed left-1/2 top-6 z-[1100] w-[min(92vw,36rem)] -translate-x-1/2 border border-amber-300/40 bg-slate-950/95 px-5 py-4 text-white shadow-2xl backdrop-blur-md pointer-events-none"
      >
        <p
          class="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/70"
        >
          ${translateText("world_congress.resolution_passed")}
        </p>
        <div class="mt-1 flex items-baseline justify-between gap-4">
          <strong class="text-lg uppercase tracking-wide">${text.title}</strong>
          <span class="font-mono text-sm text-white/45"
            >${translateText("world_congress.votes", { votes })}</span
          >
        </div>
      </aside>
    `;
  }

  private renderActiveResolution() {
    const resolution = this.congressUpdate?.activeResolution;
    if (
      this.congressUpdate?.phase !== "resolved" ||
      resolution?.expiresAt === undefined ||
      this.game === undefined ||
      this.game.ticks() >= resolution.expiresAt
    ) {
      return nothing;
    }
    const text = this.proposalText(resolution);
    const seconds = Math.ceil((resolution.expiresAt - this.game.ticks()) / 10);
    return html`
      <aside
        class="fixed bottom-4 left-1/2 z-[700] -translate-x-1/2 border border-amber-300/30 bg-slate-950/90 px-4 py-2 text-center text-white shadow-xl backdrop-blur-md pointer-events-none"
      >
        <span
          class="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/70"
        >
          ${translateText("world_congress.active_resolution")}
        </span>
        <span class="mx-2 text-sm font-bold uppercase">${text.title}</span>
        <span class="font-mono text-xs text-white/50">${seconds}s</span>
      </aside>
    `;
  }

  render() {
    return html`${this.renderVoting()}${this.renderResult()}${this.renderActiveResolution()}`;
  }
}

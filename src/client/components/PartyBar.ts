import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { partyClient, type PartyInfo } from "../PartyClient";
import type { UsernameInput } from "../UsernameInput";
import { showToast, translateText } from "../Utils";
import { shareInvite } from "../utilities/ShareInvite";

/**
 * Home-screen squad bar: create a party, invite friends via link, and follow
 * the leader into public lobbies. Rendering-only — all state lives in
 * PartyClient.
 */
@customElement("party-bar")
export class PartyBar extends LitElement {
  @state() private party: PartyInfo | null = null;
  @state() private busy = false;

  createRenderRoot() {
    return this;
  }

  private readonly handlePartyUpdated = (e: Event) => {
    this.party = (e as CustomEvent<PartyInfo | null>).detail;
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("party-updated", this.handlePartyUpdated);
    this.party = partyClient.partyInfo();
  }

  disconnectedCallback(): void {
    window.removeEventListener("party-updated", this.handlePartyUpdated);
    super.disconnectedCallback();
  }

  private playerName(): string {
    const input = document.querySelector("username-input") as
      | UsernameInput
      | null;
    return input?.getUsername() ?? "";
  }

  private async createParty(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const ok = await partyClient.create(this.playerName());
      if (!ok) {
        showToast(translateText("party.create_failed"), "red");
      }
    } finally {
      this.busy = false;
    }
  }

  private async leaveParty(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await partyClient.leave();
    } finally {
      this.busy = false;
    }
  }

  private async shareParty(): Promise<void> {
    const url = partyClient.inviteUrl();
    if (url === null) return;
    await shareInvite({
      text: translateText("party.invite_text"),
      url,
    });
  }

  render() {
    if (!partyClient.isInParty()) {
      return html`
        <div class="px-2 lg:px-0">
          <o-button
            variant="ghost"
            size="sm"
            .title=${translateText("party.play_with_friends")}
            ?disable=${this.busy}
            @click=${this.createParty}
          ></o-button>
        </div>
      `;
    }

    const members = this.party?.members ?? [];
    const isLeader = partyClient.isLeader();
    return html`
      <div
        class="mx-2 lg:mx-0 p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-xs font-bold uppercase tracking-widest text-white/60"
          >
            ${translateText("party.title", { count: String(members.length) })}
          </span>
          <div class="flex items-center gap-2">
            <o-button
              variant="secondary"
              size="xs"
              .title=${translateText("party.invite")}
              @click=${this.shareParty}
            ></o-button>
            <o-button
              variant="ghost"
              size="xs"
              .title=${translateText("party.leave")}
              ?disable=${this.busy}
              @click=${this.leaveParty}
            ></o-button>
          </div>
        </div>
        ${members.length > 0
          ? html`
              <div class="flex flex-wrap gap-1.5">
                ${members.map(
                  (m) => html`
                    <span
                      class="px-2 py-0.5 rounded-full text-xs font-bold ${m.isLeader
                        ? "bg-malibu-blue/30 text-white border border-malibu-blue/50"
                        : "bg-white/10 text-white/80 border border-white/10"}"
                    >
                      ${m.isLeader ? "★ " : ""}${m.name}
                    </span>
                  `,
                )}
              </div>
            `
          : nothing}
        <span class="text-xs text-white/50">
          ${isLeader
            ? translateText("party.leader_hint")
            : translateText("party.member_hint")}
        </span>
      </div>
    `;
  }
}

import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { OPENFRONT_COPYRIGHT_NOTICE } from "./Attribution";
import { translateText } from "./Utils";

@customElement("game-starting-modal")
export class GameStartingModal extends LitElement {
  @state()
  isVisible = false;

  createRenderRoot() {
    return this;
  }

  render() {
    const isVisible = this.isVisible;
    return html`
      <div
        class="fixed inset-0 bg-black/30 backdrop-blur-[4px] z-[9998] transition-all duration-300 ${isVisible
          ? "opacity-100 visible"
          : "opacity-0 invisible"}"
      ></div>
      <div
        class="fixed top-1/2 left-1/2 bg-zinc-900/90 backdrop-blur-md border border-white/10 p-6 rounded-2xl z-[9999] shadow-2xl text-white w-[400px] text-center transition-all duration-300 -translate-x-1/2 ${isVisible
          ? "opacity-100 visible -translate-y-1/2"
          : "opacity-0 invisible -translate-y-[48%]"}"
      >
        <div class="text-xl font-bold tracking-wider uppercase text-white mb-1">
          TradeShips.io
        </div>
        <div class="text-sm font-medium tracking-wider text-white/40 mb-1">
          ${translateText("game_starting_modal.based_on")} —
          <a
            href="https://github.com/ByGamer01/TradeShips.io/blob/main/CREDITS.md"
            target="_blank"
            rel="noopener noreferrer"
            class="text-malibu-blue no-underline transition-colors duration-200 hover:text-aquarius uppercase"
            >${translateText("game_starting_modal.credits")}</a
          >
        </div>
        <!-- Hardcoded on purpose: see src/client/Attribution.ts -->
        <p
          data-attribution="openfront"
          class="text-base font-medium tracking-wider text-white/70 mb-3"
        >
          ${OPENFRONT_COPYRIGHT_NOTICE}
        </p>
        <p class="text-base text-white/40 mb-4">
          ${translateText("game_starting_modal.code_license")}
        </p>
        <p
          class="text-xl font-medium tracking-wider text-white bg-white/5 border border-white/10 px-4 py-3 rounded-xl"
        >
          ${translateText("game_starting_modal.title")}
        </p>
      </div>
    `;
  }

  show() {
    this.isVisible = true;
    this.requestUpdate();
  }

  hide() {
    this.isVisible = false;
    this.requestUpdate();
  }
}

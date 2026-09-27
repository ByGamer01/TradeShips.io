import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import {
  OPENFRONT_COPYRIGHT_NOTICE,
  SOURCE_LICENSE_ID,
  SOURCE_LICENSE_URL,
  TRADESHIPS_COPYRIGHT_NOTICE,
} from "../Attribution";

@customElement("page-footer")
export class Footer extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <footer
        class="[.in-game_&]:hidden bg-zinc-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-1 pt-1 pb-3 text-white/50 w-full border-t border-white/10 shrink-0 relative z-50"
      >
        <div
          class="flex items-center justify-center gap-4 lg:gap-6 pt-2 w-full relative"
        >
          <a
            href="https://github.com/ByGamer01/TradeShips.io"
            target="_blank"
            rel="noopener noreferrer"
            class="opacity-60 hover:opacity-100 hover:scale-110 transition-all"
          >
            <img
              src=${assetUrl("icons/github-mark-white.svg")}
              data-i18n-alt="main.github"
              class="h-6 w-6 lg:h-7 lg:w-7 object-contain pointer-events-none"
              draggable="false"
            />
          </a>
          <a
            href="https://discord.gg/REDTnjM69U"
            target="_blank"
            rel="noopener noreferrer"
            class="opacity-60 hover:opacity-100 hover:scale-110 transition-all"
          >
            <svg
              class="h-6 w-6 lg:h-7 lg:w-7 object-contain pointer-events-none"
              viewBox="0 0 24 24"
              fill="white"
            >
              <path
                d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-14.36a.074.074 0 0 0-.032-.027zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.085 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.085 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z"
              />
            </svg>
          </a>
          <lang-selector
            class="absolute right-4 top-0 sm:top-[10px]"
          ></lang-selector>
        </div>
        <div
          class="text-xs mt-1 lg:mt-2 flex flex-col items-center gap-1 px-4 text-center"
        >
          <div class="flex items-center justify-center gap-4">
            <a
              href="/terms-of-service.html"
              data-i18n="main.terms_of_service"
              target="_blank"
              class="hover:text-white transition-colors"
            ></a>
            <a
              href=${SOURCE_LICENSE_URL}
              data-attribution="license"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-white transition-colors"
              >${SOURCE_LICENSE_ID}</a
            >
            <a
              href="/privacy-policy.html"
              data-i18n="main.privacy_policy"
              target="_blank"
              class="hover:text-white transition-colors"
            ></a>
          </div>
          <!-- Notices are hardcoded on purpose: see src/client/Attribution.ts -->
          <p
            class="text-sm text-white/70 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5"
          >
            <span data-attribution="tradeships" class="whitespace-nowrap"
              >${TRADESHIPS_COPYRIGHT_NOTICE}</span
            >
            <span aria-hidden="true">·</span>
            <span
              data-i18n="game_starting_modal.based_on"
              class="whitespace-nowrap"
            ></span>
            <span aria-hidden="true" class="hidden sm:inline">·</span>
            <span
              data-attribution="openfront"
              class="whitespace-nowrap basis-full sm:basis-auto"
              >${OPENFRONT_COPYRIGHT_NOTICE}</span
            >
          </p>
        </div>
      </footer>
    `;
  }
}

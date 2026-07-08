import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import type { TradeRouteData } from "../../render/types";
import { Controller } from "../../Controller";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
import type { TradeLedgerSummary } from "../../view/TradeLedger";

const MAX_PORTS_SHOWN = 3;

/**
 * TradeStatsPanel — the local player's trade economy at a glance.
 *
 * Live section (from FrameData.tradeRoutes): own routes in flight, how many
 * are contested or escorted, and the estimated gold currently at sea.
 * Session section (from GameView's TradeLedger): completed voyages, ships
 * lost or captured, and income per port.
 *
 * Collapsible; hidden until the player owns a port or has trade in flight.
 */
@customElement("trade-stats-panel")
export class TradeStatsPanel extends LitElement implements Controller {
  public game: GameView | undefined;
  public eventBus: EventBus | undefined;

  @state()
  private _collapsed = false;

  @state()
  private _hasTradePresence = false;

  private _ownRoutes: TradeRouteData[] = [];
  private _goldInTransit = 0;
  private _contested = 0;
  private _escorted = 0;
  private _summary: TradeLedgerSummary | null = null;

  createRenderRoot() {
    return this; // Enable Tailwind CSS
  }

  getTickIntervalMs() {
    return 500;
  }

  tick() {
    if (this.game === undefined) return;

    const me = this.game.myPlayer();
    if (me === null || !me.isAlive()) {
      this._hasTradePresence = false;
      return;
    }

    const routes = this.game.frameData().tradeRoutes;
    this._ownRoutes = routes.filter((r) => r.relation === "own");
    this._goldInTransit = this._ownRoutes.reduce(
      (sum, r) => sum + (r.estimatedGold ?? 0),
      0,
    );
    this._contested = this._ownRoutes.filter(
      (r) => r.riskLevel !== "safe",
    ).length;
    this._escorted = this._ownRoutes.filter((r) => r.escortCount > 0).length;
    this._summary = this.game.tradeLedger().summary();

    this._hasTradePresence =
      this._ownRoutes.length > 0 ||
      this._summary.arrivals > 0 ||
      this._summary.shipsLost > 0 ||
      this._summary.goldAtMyPorts > 0;

    this.requestUpdate();
  }

  render() {
    if (!this._hasTradePresence || this._summary === null) return html``;

    return html`
      <div
        class="w-56 p-2 bg-gray-800/92 backdrop-blur-sm shadow-xs min-[1200px]:rounded-lg rounded-l-lg text-white text-sm"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <button
          class="w-full flex items-center justify-between font-bold"
          @click=${() => {
            this._collapsed = !this._collapsed;
          }}
        >
          <span translate="no">⚓ ${translateText("trade_stats.title")}</span>
          <span>${this._collapsed ? "▸" : "▾"}</span>
        </button>
        ${this._collapsed ? nothing : this.renderBody(this._summary)}
      </div>
    `;
  }

  private renderBody(s: TradeLedgerSummary) {
    return html`
      <div class="mt-2 flex flex-col gap-1">
        ${this.row(
          translateText("trade_stats.routes_active"),
          `${this._ownRoutes.length}`,
        )}
        ${this.row(
          translateText("trade_stats.gold_in_transit"),
          renderNumber(this._goldInTransit),
        )}
        ${this._contested > 0
          ? this.row(
              translateText("trade_stats.routes_contested"),
              `${this._contested}`,
              "text-orange-400",
            )
          : nothing}
        ${this._escorted > 0
          ? this.row(
              translateText("trade_stats.routes_escorted"),
              `${this._escorted}`,
              "text-emerald-400",
            )
          : nothing}

        <hr class="border-gray-600 my-1" />

        ${this.row(
          translateText("trade_stats.gold_earned"),
          renderNumber(s.goldFromMyShips + s.goldAtMyPorts),
          "text-yellow-300",
        )}
        ${this.row(translateText("trade_stats.arrivals"), `${s.arrivals}`)}
        ${s.shipsLost > 0
          ? this.row(
              translateText("trade_stats.ships_lost"),
              `${s.shipsLost}`,
              "text-red-400",
            )
          : nothing}
        ${s.shipsCaptured > 0
          ? this.row(
              translateText("trade_stats.ships_captured"),
              `${s.shipsCaptured}`,
              "text-red-400",
            )
          : nothing}
        ${s.capturesByMe > 0
          ? this.row(
              translateText("trade_stats.captures_by_me"),
              `${s.capturesByMe}`,
              "text-emerald-400",
            )
          : nothing}
        ${this.renderPortIncome(s)}
      </div>
    `;
  }

  private renderPortIncome(s: TradeLedgerSummary) {
    if (s.portIncome.length === 0) return nothing;
    return html`
      <hr class="border-gray-600 my-1" />
      <div class="text-gray-300 text-xs font-bold">
        ${translateText("trade_stats.top_ports")}
      </div>
      ${s.portIncome
        .slice(0, MAX_PORTS_SHOWN)
        .map((p, i) =>
          this.row(
            `${translateText("trade_stats.port")} #${i + 1} (×${p.arrivals})`,
            renderNumber(p.gold),
            "text-yellow-200",
          ),
        )}
    `;
  }

  private row(label: string, value: string, valueClass = "") {
    return html`
      <div class="flex justify-between gap-2">
        <span class="text-gray-300">${label}</span>
        <span class="font-mono ${valueClass}" translate="no">${value}</span>
      </div>
    `;
  }
}

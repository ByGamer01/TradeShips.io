import { UnitType } from "../../core/game/Game";
import type { UnitUpdate } from "../../core/game/GameUpdates";
import type { UnitState } from "../render/types";

/** Accumulated trade income attributed to one of the local player's ports. */
export interface PortIncome {
  unitId: number;
  tile: number;
  gold: number;
  arrivals: number;
}

/** Session-long trade statistics for the local player. */
export interface TradeLedgerSummary {
  /** My trade ships that completed their voyage. */
  arrivals: number;
  /** My trade ships sunk before reaching their destination. */
  shipsLost: number;
  /** My trade ships captured by other players. */
  shipsCaptured: number;
  /** Enemy trade ships I captured. */
  capturesByMe: number;
  /** Captured ships that completed a voyage under my flag. */
  piratedArrivals: number;
  /** Gold earned by my ships completing voyages (includes pirated ones). */
  goldFromMyShips: number;
  /** Gold earned by foreign trade arriving at my ports. */
  goldAtMyPorts: number;
  /** Per-port incoming trade income, sorted by gold (descending). */
  portIncome: PortIncome[];
}

export interface TradeLedgerDeps {
  /** Local player smallID; 0 while unresolved (replay / spectator). */
  localPlayerID: () => number;
  /** Mirror of the core's tradeShipGold formula for a given owner. */
  estimateGold: (tilesTraveled: number, ownerID: number) => number;
  /** Owner smallID of a port unit, or null if unknown / not a port. */
  portOwnerID: (unitId: number) => number | null;
  /** Tile of a port unit, or null if unknown. */
  portTile: (unitId: number) => number | null;
}

/**
 * TradeLedger — client-side accounting of the local player's trade economy.
 *
 * Fed every trade-ship UnitUpdate (with the pre-update state for transition
 * detection). Arrivals are recognized by `reachedTarget` on the final update
 * — the core sets it in TradeShipExecution.complete() — and valued with the
 * authoritative `tilesTraveled` odometer, so the gold shown here matches what
 * the simulation actually paid out.
 */
export class TradeLedger {
  private _arrivals = 0;
  private _shipsLost = 0;
  private _shipsCaptured = 0;
  private _capturesByMe = 0;
  private _piratedArrivals = 0;
  private _goldFromMyShips = 0;
  private _goldAtMyPorts = 0;
  private readonly _portIncome = new Map<number, PortIncome>();

  constructor(private readonly deps: TradeLedgerDeps) {}

  /**
   * Process a trade-ship unit update. `prev` is the unit's state before this
   * update (null on first sight). Non-trade units are ignored.
   */
  onUnitUpdate(update: UnitUpdate, prev: UnitState | null): void {
    if (update.unitType !== UnitType.TradeShip) return;
    const me = this.deps.localPlayerID();
    if (me <= 0) return;

    // Ownership transition while alive → capture.
    if (prev !== null && prev.isActive && prev.ownerID !== update.ownerID) {
      if (prev.ownerID === me) this._shipsCaptured++;
      if (update.ownerID === me) this._capturesByMe++;
    }

    // Deactivation → arrival (reachedTarget) or loss.
    const justDeactivated = (prev === null || prev.isActive) && !update.isActive;
    if (!justDeactivated) return;

    if (update.reachedTarget) {
      this.recordArrival(update, me);
    } else if (update.ownerID === me) {
      this._shipsLost++;
    }
  }

  private recordArrival(update: UnitUpdate, me: number): void {
    const wasCaptured =
      update.lastOwnerID !== undefined && update.lastOwnerID !== update.ownerID;
    const gold = this.deps.estimateGold(
      update.tilesTraveled ?? 0,
      update.ownerID,
    );

    if (update.ownerID === me) {
      if (wasCaptured) {
        this._piratedArrivals++;
      } else {
        this._arrivals++;
      }
      this._goldFromMyShips += gold;
    }

    // On a regular arrival the destination port's owner is paid too;
    // captured ships only pay their captor.
    if (wasCaptured || update.targetUnitId === undefined) return;
    if (this.deps.portOwnerID(update.targetUnitId) !== me) return;

    this._goldAtMyPorts += gold;
    let income = this._portIncome.get(update.targetUnitId);
    if (income === undefined) {
      income = {
        unitId: update.targetUnitId,
        tile: this.deps.portTile(update.targetUnitId) ?? update.pos,
        gold: 0,
        arrivals: 0,
      };
      this._portIncome.set(update.targetUnitId, income);
    }
    income.gold += gold;
    income.arrivals++;
  }

  summary(): TradeLedgerSummary {
    return {
      arrivals: this._arrivals,
      shipsLost: this._shipsLost,
      shipsCaptured: this._shipsCaptured,
      capturesByMe: this._capturesByMe,
      piratedArrivals: this._piratedArrivals,
      goldFromMyShips: this._goldFromMyShips,
      goldAtMyPorts: this._goldAtMyPorts,
      portIncome: [...this._portIncome.values()].sort(
        (a, b) => b.gold - a.gold,
      ),
    };
  }
}

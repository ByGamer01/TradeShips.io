import { renderNumber } from "../../client/Utils";
import {
  Execution,
  Game,
  MessageType,
  Player,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { findClosestBy } from "../Util";

export class TradeShipExecution implements Execution {
  private active = true;
  private mg: Game;
  private tradeShip: Unit | undefined;
  private wasCaptured = false;
  private pathFinder: WaterPathFinder;
  private motionPlanId = 1;
  private motionPlanDst: TileRef | null = null;

  private static _staggerCounter = 0;

  constructor(
    private origOwner: Player,
    private srcPort: Unit,
    private _dstPort: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const stagger =
      TradeShipExecution._staggerCounter++ % WaterPathFinder.STAGGER_SPREAD;
    this.pathFinder = new WaterPathFinder(mg, stagger);
  }

  tick(ticks: number): void {
    if (this.pathFinder.rebuilt) {
      this.motionPlanDst = null; // Force motion plan re-recording
    }

    if (this.tradeShip === undefined) {
      const spawn = this.origOwner.canBuild(
        UnitType.TradeShip,
        this.srcPort.tile(),
      );
      if (spawn === false) {
        console.warn(`cannot build trade ship`);
        this.active = false;
        return;
      }
      this.tradeShip = this.origOwner.buildUnit(UnitType.TradeShip, spawn, {
        targetUnit: this._dstPort,
        lastSetSafeFromPirates: ticks,
      });
      this.mg.stats().boatSendTrade(this.origOwner, this._dstPort.owner());
    }

    if (!this.tradeShip.isActive()) {
      this.active = false;
      return;
    }

    const tradeShipOwner = this.tradeShip.owner();
    const dstPortOwner = this._dstPort.owner();
    if (this.wasCaptured !== true && this.origOwner !== tradeShipOwner) {
      // Store as variable in case ship is recaptured by previous owner
      this.wasCaptured = true;
      this.mg.displayMessage(
        "events_display.trade_ship_captured",
        MessageType.UNIT_DESTROYED,
        this.origOwner.id(),
        undefined,
        { name: tradeShipOwner.displayName() },
        this.tradeShip.id(),
      );
    }

    // If a player captures another player's port while trading we should delete
    // the ship.
    if (dstPortOwner.id() === this.srcPort.owner().id()) {
      this.tradeShip.delete(false);
      this.active = false;
      return;
    }

    if (
      !this.wasCaptured &&
      (!this._dstPort.isActive() || !tradeShipOwner.canTrade(dstPortOwner))
    ) {
      this.tradeShip.delete(false);
      this.active = false;
      return;
    }

    const curTile = this.tradeShip.tile();

    if (
      this.wasCaptured &&
      (tradeShipOwner !== dstPortOwner || !this._dstPort.isActive())
    ) {
      const myComponent = this.mg.getWaterComponent(curTile);
      const nearestPort = findClosestBy(
        tradeShipOwner.units(UnitType.Port),
        (port) => this.mg.manhattanDist(port.tile(), curTile),
        (port) =>
          port.isActive() &&
          !port.isMarkedForDeletion() &&
          !port.isUnderConstruction() &&
          myComponent !== null &&
          this.mg.hasWaterComponent(port.tile(), myComponent),
      );
      if (nearestPort === null) {
        this.tradeShip.delete(false);
        this.active = false;
        return;
      } else {
        this._dstPort = nearestPort;
        this.tradeShip.setTargetUnit(this._dstPort);
        // Plan-driven units don't emit per-tick unit updates, so force a sync for the new target.
        this.tradeShip.touch();
      }
    }

    if (curTile === this.dstPort()) {
      this.complete();
      return;
    }

    const dst = this._dstPort.tile();
    const result = this.pathFinder.next(curTile, dst);

    switch (result.status) {
      case PathStatus.NEXT:
        if (dst !== this.motionPlanDst) {
          this.motionPlanId++;
          const from = result.node;
          const path = this.pathFinder.findPath(from, dst) ?? [from];
          if (path.length === 0 || path[0] !== from) {
            path.unshift(from);
          }

          this.mg.recordMotionPlan({
            kind: "grid",
            unitId: this.tradeShip.id(),
            planId: this.motionPlanId,
            startTick: ticks + 1,
            ticksPerStep: 1,
            path,
          });
          this.motionPlanDst = dst;
        }
        // Update safeFromPirates status
        if (this.mg.isWater(result.node) && this.mg.isShoreline(result.node)) {
          this.tradeShip.setSafeFromPirates();
        } else if (this.isUnderHarborWatch(result.node)) {
          this.tradeShip.setSafeFromPirates();
        }
        this.tradeShip.move(result.node);
        // The unit is the authoritative odometer: it drives arrival gold and
        // is synced to clients on every unit update.
        this.tradeShip.setTilesTraveled(this.tradeShip.tilesTraveled() + 1);
        break;
      case PathStatus.COMPLETE:
        this.complete();
        return;
      case PathStatus.NOT_FOUND:
        console.warn("captured trade ship cannot find route");
        if (this.tradeShip.isActive()) {
          this.tradeShip.delete(false);
        }
        this.active = false;
        return;
    }
  }

  /**
   * Harbor-watch ports project a protective zone: trade ships inside it,
   * owned by (or friendly to) the port's owner, are safe from pirates.
   */
  private isUnderHarborWatch(tile: TileRef): boolean {
    const shipOwner = this.tradeShip!.owner();
    const watchPorts = this.mg.nearbyUnits(
      tile,
      this.mg.config().portWatchSafeRadius(),
      UnitType.Port,
    );
    for (const { unit: port } of watchPorts) {
      if (port.portSpecialization() !== "watch" || !port.isActive()) continue;
      const portOwner = port.owner();
      if (portOwner === shipOwner || portOwner.isFriendly(shipOwner)) {
        return true;
      }
    }
    return false;
  }

  private complete() {
    this.active = false;
    // Mark arrival before deletion so clients can tell a completed trade
    // (income) apart from a sunk ship (loss) in the final unit update.
    this.tradeShip!.setReachedTarget();
    this.tradeShip!.delete(false);
    let gold = this.mg
      .config()
      .tradeShipGold(this.tradeShip!.tilesTraveled(), this.tradeShip!.owner());
    if (this._dstPort.isActive()) {
      const levelBonus = this.mg
        .config()
        .portLevelTradeGoldBonus(this._dstPort.level());
      gold += BigInt(Math.floor(Number(gold) * levelBonus));
    }
    // Trade hubs pay a bonus on arrivals. Destination-only on purpose: the
    // client trade ledger can mirror it exactly (it knows the target port),
    // and it rewards routing commerce INTO specialized hubs.
    if (
      this._dstPort.isActive() &&
      this._dstPort.portSpecialization() === "trade"
    ) {
      const bonus = this.mg.config().portTradeSpecGoldBonus();
      gold += BigInt(Math.floor(Number(gold) * bonus));
    }
    if (!this.wasCaptured && this.isAlliedCommercialRoute()) {
      const bonus = this.mg.config().alliedTradeGoldBonus();
      gold += BigInt(Math.floor(Number(gold) * bonus));
    }

    if (this.wasCaptured) {
      const taxedGold = this.applyTariffs(
        this.tradeShip!.owner(),
        gold,
        this._dstPort.tile(),
      );
      this.tradeShip!.owner().addGold(taxedGold, this._dstPort.tile());
      this.mg.displayMessage(
        "events_display.received_gold_from_captured_ship",
        MessageType.CAPTURED_ENEMY_UNIT,
        this.tradeShip!.owner().id(),
        taxedGold,
        {
          gold: renderNumber(taxedGold),
          name: this.origOwner.displayName(),
        },
      );
      // Record stats
      this.mg
        .stats()
        .boatCapturedTrade(this.tradeShip!.owner(), this.origOwner, gold);
    } else {
      const srcGold = this.applyTariffs(
        this.srcPort.owner(),
        gold,
        this.srcPort.tile(),
      );
      const dstGold = this.applyTariffs(
        this._dstPort.owner(),
        gold,
        this._dstPort.tile(),
      );
      this.srcPort.owner().addGold(srcGold, this.srcPort.tile());
      this._dstPort.owner().addGold(dstGold, this._dstPort.tile());
      // Record stats
      this.mg
        .stats()
        .boatArriveTrade(this.srcPort.owner(), this._dstPort.owner(), gold);
    }
    return;
  }

  /**
   * Purchased tariffs skim trade-arrival gold: every player holding an
   * active tariff against the recipient collects a cut (sequentially over
   * the remainder, sorted by smallID for determinism). Returns what the
   * recipient actually keeps.
   */
  private applyTariffs(recipient: Player, gold: bigint, tile: TileRef): bigint {
    const issuers = this.mg
      .players()
      .filter(
        (player) => player !== recipient && player.hasTariffAgainst(recipient),
      )
      .sort((a, b) => a.smallID() - b.smallID());
    if (issuers.length === 0) return gold;

    const rate = this.mg.config().tariffTradeTaxRate();
    let remaining = gold;
    for (const issuer of issuers) {
      const cut = BigInt(Math.floor(Number(remaining) * rate));
      if (cut <= 0n) continue;
      remaining -= cut;
      issuer.addGold(cut, tile);
    }
    return remaining;
  }

  private isAlliedCommercialRoute(): boolean {
    const sourceOwner = this.srcPort.owner();
    const destinationOwner = this._dstPort.owner();
    return (
      sourceOwner.isFriendly(destinationOwner) ||
      destinationOwner.isFriendly(sourceOwner)
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  dstPort(): TileRef {
    return this._dstPort.tile();
  }
}

import {
  Execution,
  Game,
  isUnit,
  OwnerComp,
  Unit,
  UnitParams,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { isCongressResolutionActive } from "../game/WorldCongress";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";
import { findMinimumBy } from "../Util";
import { TorpedoExecution } from "./TorpedoExecution";

const SURFACE_WARSHIP_TYPES = [
  UnitType.Warship,
  UnitType.AntiAirFrigate,
] as const;

function isSurfaceWarship(unit: Unit): boolean {
  return SURFACE_WARSHIP_TYPES.includes(
    unit.type() as (typeof SURFACE_WARSHIP_TYPES)[number],
  );
}

export class WarshipExecution implements Execution {
  private random: PseudoRandom;
  private warship: Unit;
  private mg: Game;
  private pathfinder: WaterPathFinder;
  private lastShellAttack = 0;
  private alreadySentShell = new Set<Unit>();
  private lastManualMoveTickRetreatDisabled = 0;
  private lastObservedPatrolTile: TileRef | undefined;
  private activeHealingRemainder = 0;
  private lastEmittedCombat = false;
  /** Cached resolution of warshipState().escortUnitId. */
  private escortTarget: Unit | undefined;

  constructor(
    private input: (UnitParams<UnitType.Warship> & OwnerComp) | Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());
    if (isUnit(this.input)) {
      this.warship = this.input;
    } else {
      const spawn = this.input.owner.canBuild(
        UnitType.Warship,
        this.input.patrolTile,
      );
      if (spawn === false) {
        console.warn(
          `Failed to spawn warship for ${this.input.owner.name()} at ${this.input.patrolTile}`,
        );
        return;
      }
      this.warship = this.input.owner.buildUnit(
        UnitType.Warship,
        spawn,
        this.input,
      );
    }
    this.lastObservedPatrolTile = this.warship.warshipState().patrolTile;
  }

  tick(ticks: number): void {
    if (this.warship.health() <= 0) {
      this.warship.delete();
      return;
    }
    const isInCombat = this.warship.warshipState().isInCombat ?? false;
    if (this.lastEmittedCombat && !isInCombat) {
      this.warship.touch();
    }
    this.lastEmittedCombat = isInCombat;
    const healthBeforeHealing = this.warship.health();

    this.healWarship();
    this.handleManualPatrolOverride();
    this.handleEscort();

    if (this.warship.warshipState().state === "docked") {
      if (this.currentRetreatPort() === undefined) {
        this.cancelRepairRetreat();
      }
      if (this.isFullyHealed()) {
        this.cancelRepairRetreat();
      }
      if (this.warship.warshipState().state === "docked") {
        return;
      }
    }

    if (this.handleRepairRetreat()) {
      return;
    }

    // Priority 1: Check if need to heal before doing anything else
    if (this.shouldStartRepairRetreat(healthBeforeHealing)) {
      this.startRepairRetreat();
      if (this.handleRepairRetreat()) {
        return;
      }
    }

    this.warship.setTargetUnit(this.findTargetUnit());

    // Priority 1: Shoot transport ship if in range
    if (this.warship.targetUnit()?.type() === UnitType.TransportShip) {
      this.shootTarget();
      this.patrol();
      return;
    }

    // Priority 2: Fight enemy combat ships (incl. carriers and close-range
    // submarines) if in range
    const combatTargetType = this.warship.targetUnit()?.type();
    if (
      combatTargetType === UnitType.Warship ||
      combatTargetType === UnitType.AntiAirFrigate ||
      combatTargetType === UnitType.AircraftCarrier ||
      combatTargetType === UnitType.Submarine
    ) {
      this.shootTarget();
      this.patrol();
      return;
    }

    // Priority 3: Hunt trade ship only if not healing and no enemy warship
    if (this.warship.targetUnit()?.type() === UnitType.TradeShip) {
      if (isCongressResolutionActive(this.mg, "open_seas")) {
        this.warship.setTargetUnit(undefined);
        this.patrol();
        return;
      }
      this.huntDownTradeShip();
      return;
    }

    this.patrol();
  }

  private healWarship(): void {
    const owner = this.warship.owner();
    const passiveHealing = this.mg.config().warshipPassiveHealing();
    const passiveHealingRange = this.mg.config().warshipPassiveHealingRange();
    const passiveHealingRangeSquared =
      passiveHealingRange * passiveHealingRange;
    const warshipTile = this.warship.tile();

    let isNearRepairHub = false;
    for (const port of owner.units(UnitType.Port)) {
      const distSquared = this.mg.euclideanDistSquared(
        warshipTile,
        port.tile(),
      );
      if (distSquared <= passiveHealingRangeSquared) {
        isNearRepairHub = true;
        break;
      }
    }
    if (!isNearRepairHub) {
      for (const carrier of owner.units(UnitType.AircraftCarrier)) {
        const distSquared = this.mg.euclideanDistSquared(
          warshipTile,
          carrier.tile(),
        );
        if (distSquared <= passiveHealingRangeSquared) {
          isNearRepairHub = true;
          break;
        }
      }
    }

    if (isNearRepairHub) {
      this.warship.modifyHealth(passiveHealing);
    }

    if (this.warship.warshipState().state === "docked") {
      this.applyActiveDockedHealing();
    }
  }

  private isFullyHealed(): boolean {
    const maxHealth = this.mg.config().unitInfo(this.warship.type()).maxHealth;
    if (typeof maxHealth !== "number") {
      return true;
    }
    return this.warship.health() >= maxHealth;
  }

  private shouldStartRepairRetreat(
    healthBeforeHealing = this.warship.health(),
  ): boolean {
    if (this.warship.warshipState().state !== "patrolling") {
      return false;
    }
    const manualMoveRetreatDisabledDuration = 50;
    if (
      this.mg.ticks() - this.lastManualMoveTickRetreatDisabled <
      manualMoveRetreatDisabledDuration
    ) {
      return false;
    }
    if (
      healthBeforeHealing >= this.mg.config().warshipRetreatHealthThreshold()
    ) {
      return false;
    }
    return this.repairHubs().length > 0;
  }

  private repairHubs(): Unit[] {
    return this.warship.owner().units(UnitType.Port, UnitType.AircraftCarrier);
  }

  private findNearestRepairHubTile(): TileRef | undefined {
    const hubs = this.repairHubs();
    if (hubs.length === 0) {
      return undefined;
    }

    const warshipTile = this.warship.tile();
    const warshipComponent = this.mg.getWaterComponent(warshipTile);
    if (warshipComponent === null) {
      throw new Error(`Warship at tile ${warshipTile} has no water component`);
    }

    const nearest = findMinimumBy(
      hubs,
      (hub) => this.mg.euclideanDistSquared(warshipTile, hub.tile()),
      (hub) => {
        const hubComponent = this.mg.getWaterComponent(hub.tile());
        if (hubComponent === null) {
          throw new Error(
            `Repair hub at tile ${hub.tile()} has no water component`,
          );
        }
        return hubComponent === warshipComponent;
      },
    );

    return nearest?.tile();
  }

  private findRetreatAggroTarget(): Unit | undefined {
    return this.findBestTarget([
      UnitType.TransportShip,
      UnitType.Warship,
      UnitType.AntiAirFrigate,
    ]);
  }

  private findTargetUnit(): Unit | undefined {
    return this.findBestTarget(
      [
        UnitType.TransportShip,
        UnitType.Warship,
        UnitType.AntiAirFrigate,
        UnitType.AircraftCarrier,
        UnitType.Submarine,
        UnitType.TradeShip,
      ],
      true,
    );
  }

  /**
   * Shared target selection: searches nearby units of given types,
   * filters common exclusions (self, friendly, docked, already-shelled),
   * picks best by type priority (lower index = higher priority) then distance.
   *
   * When `includeTradeShips` is true, applies trade-ship-specific filters
   * (safe from pirates, patrol range, water component, allied destination).
   */
  private findBestTarget(
    types: UnitType[],
    includeTradeShips = false,
  ): Unit | undefined {
    const mg = this.mg;
    const config = mg.config();
    const owner = this.warship.owner();

    const ships = mg.nearbyUnits(
      this.warship.tile(),
      config.warshipTargettingRange(),
      types,
    );

    // Trade-ship-specific state, lazily computed.
    let hasPort: boolean | undefined;
    let patrolTile: number | undefined;
    let patrolRangeSquared: number | undefined;
    let warshipComponent: number | null | undefined = undefined;

    let bestUnit: Unit | undefined = undefined;
    let bestTypePriority = 0;
    let bestDistSquared = 0;

    for (const { unit, distSquared } of ships) {
      if (
        unit === this.warship ||
        unit.owner() === owner ||
        !owner.canAttackPlayer(unit.owner(), true) ||
        this.alreadySentShell.has(unit) ||
        (isSurfaceWarship(unit) && unit.warshipState().state === "docked")
      ) {
        continue;
      }

      const type = unit.type();

      if (
        type === UnitType.TransportShip ||
        type === UnitType.Warship ||
        type === UnitType.AntiAirFrigate ||
        type === UnitType.AircraftCarrier ||
        type === UnitType.Submarine ||
        type === UnitType.TradeShip
      ) {
        if (warshipComponent === undefined) {
          warshipComponent = mg.getWaterComponent(this.warship.tile());
        }
        if (
          warshipComponent !== null &&
          !mg.hasWaterComponent(unit.tile(), warshipComponent)
        ) {
          continue;
        }
      }

      // Submerged submarines can only be engaged at close range.
      if (
        type === UnitType.Submarine &&
        distSquared > config.submarineEngagementRange() ** 2
      ) {
        continue;
      }

      if (includeTradeShips && type === UnitType.TradeShip) {
        if (isCongressResolutionActive(mg, "open_seas")) continue;
        if (hasPort === undefined) {
          hasPort = owner.unitCount(UnitType.Port) > 0;
          patrolTile = this.warship.warshipState().patrolTile;
          patrolRangeSquared = config.warshipPatrolRange() ** 2;
        }
        if (
          !hasPort ||
          patrolTile === undefined ||
          unit.isSafeFromPirates() ||
          unit.targetUnit()?.owner() === owner ||
          unit.targetUnit()?.owner().isFriendly(owner)
        ) {
          continue;
        }
        if (
          mg.euclideanDistSquared(patrolTile, unit.tile()) > patrolRangeSquared!
        ) {
          continue;
        }
      }

      const typePriority = types.indexOf(type);

      if (
        bestUnit === undefined ||
        typePriority < bestTypePriority ||
        (typePriority === bestTypePriority && distSquared < bestDistSquared)
      ) {
        bestUnit = unit;
        bestTypePriority = typePriority;
        bestDistSquared = distSquared;
      }
    }

    return bestUnit;
  }

  private startRepairRetreat(): void {
    const repairHubTile = this.findNearestRepairHubTile();
    if (repairHubTile === undefined) {
      return;
    }
    this.warship.updateWarshipState({
      retreatPort: repairHubTile,
      state: "retreating",
    });
    this.activeHealingRemainder = 0;
    this.warship.setTargetUnit(undefined);
  }

  private cancelRepairRetreat(clearTargetTile = true): void {
    this.activeHealingRemainder = 0;
    this.warship.updateWarshipState({
      state: "patrolling",
      retreatPort: undefined,
    });
    if (clearTargetTile) {
      this.warship.setTargetTile(undefined);
    }
  }

  /**
   * Escort duty: the patrol anchor follows the escorted trade ship, so the
   * existing patrol + engagement logic defends the convoy. The escort ends
   * when the convoy arrives, sinks, or is captured by a hostile — the
   * warship then resumes a normal patrol where it stands. Repair retreats
   * keep priority: the anchor freezes while the warship heals and duty
   * resumes afterward.
   */
  private handleEscort(): void {
    const escortUnitId = this.warship.warshipState().escortUnitId;
    if (escortUnitId === undefined) {
      this.escortTarget = undefined;
      return;
    }

    const owner = this.warship.owner();
    const target = this.resolveEscortTarget(escortUnitId);
    if (
      target === undefined ||
      !target.isActive() ||
      (target.owner() !== owner && !target.owner().isFriendly(owner))
    ) {
      this.escortTarget = undefined;
      this.warship.updateWarshipState({
        escortUnitId: undefined,
        patrolTile: this.warship.tile(),
      });
      this.lastObservedPatrolTile = this.warship.tile();
      return;
    }

    if (this.warship.warshipState().state !== "patrolling") {
      return;
    }

    const anchor = target.tile();
    this.warship.updateWarshipState({ patrolTile: anchor });
    // The anchor moving with the convoy is not a manual order — keep the
    // manual-move detection (and its retreat lockout) quiet.
    this.lastObservedPatrolTile = anchor;

    // If the convoy pulls away, drop the random waypoint and close in.
    const catchUpDist = this.mg.config().warshipPatrolRange() / 2;
    if (
      this.mg.euclideanDistSquared(this.warship.tile(), anchor) >
      catchUpDist * catchUpDist
    ) {
      this.warship.setTargetTile(anchor);
    }
  }

  private resolveEscortTarget(escortUnitId: number): Unit | undefined {
    if (
      this.escortTarget !== undefined &&
      this.escortTarget.id() === escortUnitId
    ) {
      return this.escortTarget;
    }
    const unit = this.mg.unit(escortUnitId);
    this.escortTarget =
      unit !== undefined && unit.type() === UnitType.TradeShip
        ? unit
        : undefined;
    return this.escortTarget;
  }

  private handleManualPatrolOverride(): void {
    const patrolTile = this.warship.warshipState().patrolTile;
    if (
      this.lastObservedPatrolTile !== undefined &&
      patrolTile !== this.lastObservedPatrolTile
    ) {
      this.lastManualMoveTickRetreatDisabled = this.mg.ticks();
      if (this.warship.warshipState().state !== "patrolling") {
        this.cancelRepairRetreat(false);
      }
    }
    this.lastObservedPatrolTile = patrolTile;
  }

  private handleRepairRetreat(): boolean {
    if (this.warship.warshipState().state === "patrolling") {
      return false;
    }

    const retreatAggroTarget = this.findRetreatAggroTarget();
    if (retreatAggroTarget) {
      this.warship.setTargetUnit(retreatAggroTarget);
      this.shootTarget();
      // Fall through — continue retreating toward port even while firing back.
    }

    if (!this.refreshRetreatPortTile()) {
      this.cancelRepairRetreat();
      return false;
    }

    // Only clear the target when there's no active aggro target this tick.
    if (!retreatAggroTarget) {
      this.warship.setTargetUnit(undefined);
    }

    const retreatHubTile = this.warship.warshipState().retreatPort;
    if (retreatHubTile === undefined) {
      return false;
    }

    const dockingRadius = this.mg.config().warshipDockingRange();
    const dockingRadiusSq = dockingRadius * dockingRadius;
    const distToHub = this.mg.euclideanDistSquared(
      this.warship.tile(),
      retreatHubTile,
    );

    if (distToHub <= dockingRadiusSq) {
      const hub = this.repairHubs().find((h) => h.tile() === retreatHubTile);
      if (hub && !this.isRepairHubFullOfHealing(hub, this.warship)) {
        this.warship.setTargetTile(undefined);
        this.warship.updateWarshipState({
          state: "docked",
        });
        return true;
      } else {
        // Port is full - wait near port, but leave if already fully healed
        if (this.isFullyHealed()) {
          this.cancelRepairRetreat();
          return false;
        }
        return true;
      }
    }

    this.warship.setTargetTile(retreatHubTile);
    const result = this.pathfinder.next(this.warship.tile(), retreatHubTile);
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.warship.move(result.node);
        if (result.node === retreatHubTile) {
          this.warship.setTargetTile(undefined);
        }
        break;
      case PathStatus.NEXT:
        this.warship.move(result.node);
        break;
      case PathStatus.NOT_FOUND: {
        const newPort = this.findNearestAvailableRepairHubTile();
        this.warship.updateWarshipState({
          retreatPort: newPort,
        });
        if (newPort === undefined) {
          this.cancelRepairRetreat();
        }
        break;
      }
    }

    return true;
  }

  private refreshRetreatPortTile(): boolean {
    const hubs = this.repairHubs();
    if (hubs.length === 0) {
      return false;
    }

    const currentRetreatPort = this.warship.warshipState().retreatPort;

    // Check if current retreat hub still exists at that tile.
    const currentHubExists =
      currentRetreatPort !== undefined &&
      hubs.some((hub) => hub.tile() === currentRetreatPort);

    if (!currentHubExists) {
      const newPort = this.findNearestAvailableRepairHubTile();
      this.warship.updateWarshipState({
        retreatPort: newPort,
      });
      return newPort !== undefined;
    }

    // Check if current repair hub is now full of healing.
    const currentHub = hubs.find((hub) => hub.tile() === currentRetreatPort);
    if (currentHub && this.isRepairHubFullOfHealing(currentHub)) {
      // Current hub is at healing capacity, look for alternatives.
      const alternativePort = this.findNearestAvailableRepairHub();
      if (alternativePort) {
        this.warship.updateWarshipState({
          retreatPort: alternativePort,
        });
      }
      return this.warship.warshipState().retreatPort !== undefined;
    }

    // Check if a significantly closer repair hub is available
    const closerPort = this.findBetterRepairHubTile();
    if (closerPort && closerPort !== currentRetreatPort) {
      this.warship.updateWarshipState({
        retreatPort: closerPort,
      });
      return true;
    }

    return true;
  }

  private isRepairHubFullOfHealing(hub: Unit, excludeShip?: Unit): boolean {
    // Naval-base ports offer extra healing berths.
    const navalBonus =
      hub.type() === UnitType.Port && hub.portSpecialization() === "naval"
        ? this.mg.config().portNavalSpecHealingSlotsBonus()
        : 0;
    const maxShipsHealing = hub.level() + navalBonus;
    return (
      this.dockedShipsAtRepairHub(hub, excludeShip).length >= maxShipsHealing
    );
  }

  private dockedShipsAtRepairHub(hub: Unit, excludeShip?: Unit): Unit[] {
    const dockingRadius = this.mg.config().warshipDockingRange();
    const owner = this.warship.owner();

    return this.mg
      .nearbyUnits(hub.tile(), dockingRadius, [
        UnitType.Warship,
        UnitType.AntiAirFrigate,
      ])
      .filter(({ unit: ship }) => {
        if (excludeShip && ship === excludeShip) return false;
        if (ship.owner() !== owner) return false;
        if (ship.warshipState().state === "patrolling") return false;
        if (ship.targetTile() !== undefined) return false;
        return true;
      })
      .map(({ unit }) => unit);
  }

  private applyActiveDockedHealing(): void {
    const dockedHub = this.currentRetreatPort();
    if (!dockedHub) {
      return;
    }

    const dockedShips = this.dockedShipsAtRepairHub(dockedHub);
    if (!dockedShips.some((ship) => ship === this.warship)) {
      return;
    }

    const healingPool =
      dockedHub.level() * this.mg.config().warshipPortHealingBonusPerLevel();
    if (healingPool <= 0 || dockedShips.length === 0) {
      return;
    }

    // Preserve fractional split healing over time with a per-ship remainder.
    const activeHealing = healingPool / dockedShips.length;
    this.activeHealingRemainder += activeHealing;
    const integerHealing = Math.floor(this.activeHealingRemainder);
    if (integerHealing <= 0) {
      return;
    }

    this.activeHealingRemainder -= integerHealing;
    this.warship.modifyHealth(integerHealing);
  }

  private currentRetreatPort(): Unit | undefined {
    const retreatPort = this.warship.warshipState().retreatPort;
    if (retreatPort === undefined) {
      return undefined;
    }

    return this.repairHubs().find((hub) => hub.tile() === retreatPort);
  }

  private nearestAvailableRepairHubTile(
    excludeShip?: Unit,
  ): { tile: TileRef; distSquared: number } | undefined {
    const hubs = this.repairHubs();
    const warshipTile = this.warship.tile();
    const warshipComponent = this.mg.getWaterComponent(warshipTile);
    if (warshipComponent === null) {
      throw new Error(`Warship at tile ${warshipTile} has no water component`);
    }

    let bestTile: TileRef | undefined = undefined;
    let bestDistance = Infinity;

    for (const hub of hubs) {
      if (this.isRepairHubFullOfHealing(hub, excludeShip)) {
        continue;
      }

      const portTile = hub.tile();
      if (!this.mg.hasWaterComponent(portTile, warshipComponent)) {
        continue;
      }

      const distance = this.mg.euclideanDistSquared(warshipTile, portTile);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTile = portTile;
      }
    }

    return bestTile !== undefined
      ? { tile: bestTile, distSquared: bestDistance }
      : undefined;
  }

  private findNearestAvailableRepairHub(): TileRef | undefined {
    return this.nearestAvailableRepairHubTile()?.tile;
  }

  private findBetterRepairHubTile(): TileRef | undefined {
    const result = this.nearestAvailableRepairHubTile();
    if (!result) return undefined;

    let currentDistance = Infinity;
    const currentRetreatPort = this.warship.warshipState().retreatPort;
    if (currentRetreatPort !== undefined) {
      currentDistance = this.mg.euclideanDistSquared(
        this.warship.tile(),
        currentRetreatPort,
      );
    }

    if (
      result.distSquared <
      currentDistance * this.mg.config().warshipPortSwitchThreshold()
    ) {
      return result.tile;
    }
    return undefined;
  }

  private findNearestAvailableRepairHubTile(): TileRef | undefined {
    return this.nearestAvailableRepairHubTile(this.warship)?.tile;
  }

  private shootTarget() {
    this.warship.updateWarshipState({ isInCombat: true });
    const torpedoAttackRate = this.mg.config().warshipTorpedoAttackRate();
    if (this.mg.ticks() - this.lastShellAttack > torpedoAttackRate) {
      if (this.warship.targetUnit()?.type() !== UnitType.TransportShip) {
        // Warships don't need to reload when attacking transport ships.
        this.lastShellAttack = this.mg.ticks();
      }
      this.mg.addExecution(
        new TorpedoExecution(
          this.warship.tile(),
          this.warship.owner(),
          this.warship,
          this.warship.targetUnit()!,
        ),
      );
      if (!this.warship.targetUnit()!.hasHealth()) {
        // Don't send multiple shells to target that can be oneshotted
        this.alreadySentShell.add(this.warship.targetUnit()!);
        this.warship.setTargetUnit(undefined);
        return;
      }
    }
  }

  private huntDownTradeShip() {
    this.warship.updateWarshipState({ isInCombat: true });
    for (let i = 0; i < 2; i++) {
      const target = this.warship.targetUnit()!;
      const targetTile = target.tile();
      const dist = this.mg.manhattanDist(this.warship.tile(), targetTile);

      if (dist <= 5) {
        this.warship.owner().captureUnit(target);
        this.warship.setTargetUnit(undefined);
        this.warship.touch();
        return;
      }

      // When close, the minimap (2x scale) produces diagonal upscaled paths that
      // make it hard to converge. Use direct greedy movement instead.
      if (dist <= 20) {
        const nextTile = this.bestNeighborToward(targetTile);
        if (nextTile !== undefined) {
          this.warship.move(nextTile);
          continue;
        }
      }

      const result = this.pathfinder.next(this.warship.tile(), targetTile, 5);
      switch (result.status) {
        case PathStatus.COMPLETE:
          this.warship.owner().captureUnit(target);
          this.warship.setTargetUnit(undefined);
          this.warship.touch();
          return;
        case PathStatus.NEXT:
          this.warship.move(result.node);
          break;
        case PathStatus.NOT_FOUND:
          console.log(`path not found to target`);
          break;
      }
    }
  }

  private bestNeighborToward(targetTile: TileRef): TileRef | undefined {
    const warshipTile = this.warship.tile();
    let best: TileRef | undefined;
    let bestDist = this.mg.manhattanDist(warshipTile, targetTile);
    this.mg.forEachNeighbor(warshipTile, (neighbor) => {
      if (!this.mg.isWater(neighbor)) return;
      const d = this.mg.manhattanDist(neighbor, targetTile);
      if (d < bestDist) {
        bestDist = d;
        best = neighbor;
      }
    });
    return best;
  }

  private patrol() {
    if (this.warship.targetTile() === undefined) {
      this.warship.setTargetTile(this.randomTile());
      if (this.warship.targetTile() === undefined) {
        return;
      }
    }

    const result = this.pathfinder.next(
      this.warship.tile(),
      this.warship.targetTile()!,
    );
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.warship.setTargetTile(undefined);
        this.warship.move(result.node);
        break;
      case PathStatus.NEXT:
        this.warship.move(result.node);
        break;
      case PathStatus.NOT_FOUND: {
        console.log(`path not found to target`);
        this.warship.setTargetTile(undefined);
        break;
      }
    }
  }

  isActive(): boolean {
    return this.warship?.isActive();
  }

  isDocked(): boolean {
    return (this.warship?.warshipState().state ?? "patrolling") === "docked";
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  randomTile(allowShoreline: boolean = false): TileRef | undefined {
    let warshipPatrolRange = this.mg.config().warshipPatrolRange();
    const maxAttemptBeforeExpand: number = 500;
    let attempts: number = 0;
    let expandCount: number = 0;

    // Get warship's water component for connectivity check
    const warshipComponent = this.mg.getWaterComponent(this.warship.tile());

    const patrolTile = this.warship.warshipState().patrolTile;
    if (patrolTile === undefined) {
      return undefined;
    }

    while (expandCount < 3) {
      const x =
        this.mg.x(patrolTile) +
        this.random.nextInt(-warshipPatrolRange / 2, warshipPatrolRange / 2);
      const y =
        this.mg.y(patrolTile) +
        this.random.nextInt(-warshipPatrolRange / 2, warshipPatrolRange / 2);
      if (!this.mg.isValidCoord(x, y)) {
        continue;
      }
      const tile = this.mg.ref(x, y);
      if (
        !this.mg.isWater(tile) ||
        (!allowShoreline && this.mg.isShoreline(tile))
      ) {
        attempts++;
        if (attempts === maxAttemptBeforeExpand) {
          expandCount++;
          attempts = 0;
          warshipPatrolRange =
            warshipPatrolRange + Math.floor(warshipPatrolRange / 2);
        }
        continue;
      }
      // Check water component connectivity
      if (
        warshipComponent !== null &&
        !this.mg.hasWaterComponent(tile, warshipComponent)
      ) {
        attempts++;
        if (attempts === maxAttemptBeforeExpand) {
          expandCount++;
          attempts = 0;
          warshipPatrolRange =
            warshipPatrolRange + Math.floor(warshipPatrolRange / 2);
        }
        continue;
      }
      return tile;
    }
    console.warn(
      `Failed to find random tile for warship for ${this.warship.owner().name()}`,
    );
    if (!allowShoreline) {
      // If we failed to find a tile on the ocean, try again but allow shoreline
      return this.randomTile(true);
    }
    return undefined;
  }
}

import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";
import { TorpedoExecution } from "./TorpedoExecution";
import { randomPatrolTile } from "./utils/NavalPatrol";

/** Target priority: lower index = higher priority. */
const SUBMARINE_TARGET_TYPES = [
  UnitType.TransportShip,
  UnitType.Warship,
  UnitType.AntiAirFrigate,
  UnitType.AircraftCarrier,
] as const;

/**
 * Submarine: a cheap stealth combatant. Patrols like a warship and fires
 * torpedoes at enemy military shipping. Surface warships can only engage it
 * inside the (short) submarineEngagementRange, so its natural counters are
 * naval mines and carrier aircraft.
 */
export class SubmarineExecution implements Execution {
  private active = true;
  private mg: Game;
  private sub: Unit | undefined;
  private random: PseudoRandom;
  private pathfinder: WaterPathFinder;
  private lastTorpedoAttack = 0;
  private alreadyTorpedoed = new Set<Unit>();
  private patrolDestination: TileRef | undefined;

  constructor(
    private player: Player,
    private patrolTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());

    const spawn = this.player.canBuild(UnitType.Submarine, this.patrolTile);
    if (spawn === false) {
      console.warn(
        `Failed to spawn submarine for ${this.player.name()} at ${this.patrolTile}`,
      );
      this.active = false;
      return;
    }
    this.sub = this.player.buildUnit(UnitType.Submarine, spawn, {});
  }

  tick(ticks: number): void {
    if (this.sub === undefined || !this.sub.isActive()) {
      this.active = false;
      return;
    }
    if (this.sub.health() <= 0) {
      this.sub.delete();
      this.active = false;
      return;
    }

    const target = this.findTarget();
    if (target !== undefined) {
      this.shootTorpedo(target);
    }
    this.patrol();
  }

  private findTarget(): Unit | undefined {
    const mg = this.mg;
    const owner = this.sub!.owner();
    const subTile = this.sub!.tile();
    const subComponent = mg.getWaterComponent(subTile);

    const ships = mg.nearbyUnits(
      subTile,
      mg.config().warshipTargettingRange(),
      SUBMARINE_TARGET_TYPES as unknown as UnitType[],
    );

    let bestUnit: Unit | undefined;
    let bestPriority = 0;
    let bestDistSquared = 0;

    for (const { unit, distSquared } of ships) {
      if (
        unit.owner() === owner ||
        !owner.canAttackPlayer(unit.owner(), true) ||
        this.alreadyTorpedoed.has(unit) ||
        ((unit.type() === UnitType.Warship ||
          unit.type() === UnitType.AntiAirFrigate) &&
          unit.warshipState().state === "docked")
      ) {
        continue;
      }

      // Torpedoes swim: targets must share the submarine's water component.
      if (
        subComponent !== null &&
        !mg.hasWaterComponent(unit.tile(), subComponent)
      ) {
        continue;
      }

      const priority = SUBMARINE_TARGET_TYPES.indexOf(
        unit.type() as (typeof SUBMARINE_TARGET_TYPES)[number],
      );
      if (
        bestUnit === undefined ||
        priority < bestPriority ||
        (priority === bestPriority && distSquared < bestDistSquared)
      ) {
        bestUnit = unit;
        bestPriority = priority;
        bestDistSquared = distSquared;
      }
    }

    return bestUnit;
  }

  private shootTorpedo(target: Unit): void {
    const attackRate = this.mg.config().submarineTorpedoAttackRate();
    if (this.mg.ticks() - this.lastTorpedoAttack <= attackRate) {
      return;
    }
    this.lastTorpedoAttack = this.mg.ticks();
    this.mg.addExecution(
      new TorpedoExecution(
        this.sub!.tile(),
        this.sub!.owner(),
        this.sub!,
        target,
      ),
    );
    if (!target.hasHealth()) {
      // Healthless targets die to a single torpedo — don't waste more.
      this.alreadyTorpedoed.add(target);
    }
  }

  private patrol(): void {
    const manualDestination = this.sub!.targetTile();
    if (manualDestination !== undefined) {
      this.patrolDestination = undefined;
      this.moveToward(manualDestination, true);
      return;
    }

    if (this.patrolDestination === undefined) {
      this.patrolDestination = randomPatrolTile(
        this.mg,
        this.random,
        this.patrolTile,
        this.sub!.tile(),
        this.mg.config().warshipPatrolRange(),
      );
      if (this.patrolDestination === undefined) {
        return;
      }
    }

    this.moveToward(this.patrolDestination, false);
  }

  private moveToward(destination: TileRef, manual: boolean): void {
    const result = this.pathfinder.next(this.sub!.tile(), destination);
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.sub!.move(result.node);
        if (manual) {
          // Re-anchor the patrol on the new station so the sub holds
          // position instead of sailing back to its spawn area.
          this.patrolTile = destination;
          this.sub!.setTargetTile(undefined);
        } else {
          this.patrolDestination = undefined;
        }
        break;
      case PathStatus.NEXT:
        this.sub!.move(result.node);
        break;
      case PathStatus.NOT_FOUND:
        if (manual) {
          this.sub!.setTargetTile(undefined);
        } else {
          this.patrolDestination = undefined;
        }
        break;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

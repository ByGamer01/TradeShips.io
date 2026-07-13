import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";
import { AircraftExecution } from "./AircraftExecution";
import { randomPatrolTile } from "./utils/NavalPatrol";

/** Target priority: lower index = higher priority. */
const CARRIER_TARGET_TYPES = [
  UnitType.TransportShip,
  UnitType.Warship,
  UnitType.AircraftCarrier,
  UnitType.AntiAirFrigate,
  UnitType.Submarine,
] as const;
const MAX_ACTIVE_AIRCRAFT_PER_CARRIER = 3;

/**
 * Aircraft carrier: a slow, expensive strike platform. Patrols like a
 * warship and launches aircraft at enemy ships inside carrierStrikeRange.
 * Aircraft fly over land, so the carrier does not require its targets to
 * share a water component.
 */
export class CarrierExecution implements Execution {
  private active = true;
  private mg: Game;
  private carrier: Unit | undefined;
  private random: PseudoRandom;
  private pathfinder: WaterPathFinder;
  private lastAircraftLaunch = 0;
  private alreadyStruck = new Set<Unit>();
  private activeAircraft = new Set<AircraftExecution>();
  private patrolDestination: TileRef | undefined;

  constructor(
    private player: Player,
    private patrolTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());

    const spawn = this.player.canBuild(
      UnitType.AircraftCarrier,
      this.patrolTile,
    );
    if (spawn === false) {
      console.warn(
        `Failed to spawn carrier for ${this.player.name()} at ${this.patrolTile}`,
      );
      this.active = false;
      return;
    }
    this.carrier = this.player.buildUnit(UnitType.AircraftCarrier, spawn, {});
  }

  tick(ticks: number): void {
    if (this.carrier === undefined || !this.carrier.isActive()) {
      this.active = false;
      return;
    }
    if (this.carrier.health() <= 0) {
      this.carrier.delete();
      this.active = false;
      return;
    }

    const target = this.findTarget();
    if (target !== undefined) {
      this.launchAircraft(target);
    }
    this.patrol();
  }

  private findTarget(): Unit | undefined {
    const mg = this.mg;
    const owner = this.carrier!.owner();

    const ships = mg.nearbyUnits(
      this.carrier!.tile(),
      mg.config().carrierStrikeRange(),
      CARRIER_TARGET_TYPES as unknown as UnitType[],
    );

    let bestUnit: Unit | undefined;
    let bestPriority = 0;
    let bestDistSquared = 0;

    for (const { unit, distSquared } of ships) {
      if (
        unit.owner() === owner ||
        !owner.canAttackPlayer(unit.owner(), true) ||
        this.alreadyStruck.has(unit) ||
        ((unit.type() === UnitType.Warship ||
          unit.type() === UnitType.AntiAirFrigate) &&
          unit.warshipState().state === "docked")
      ) {
        continue;
      }

      const priority = CARRIER_TARGET_TYPES.indexOf(
        unit.type() as (typeof CARRIER_TARGET_TYPES)[number],
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

  private launchAircraft(target: Unit): void {
    for (const aircraft of this.activeAircraft) {
      if (!aircraft.isActive()) {
        this.activeAircraft.delete(aircraft);
      }
    }
    if (this.activeAircraft.size >= MAX_ACTIVE_AIRCRAFT_PER_CARRIER) {
      return;
    }

    const attackRate = this.mg.config().carrierAircraftAttackRate();
    if (this.mg.ticks() - this.lastAircraftLaunch <= attackRate) {
      return;
    }
    this.lastAircraftLaunch = this.mg.ticks();
    const aircraft = new AircraftExecution(
      this.carrier!.tile(),
      this.carrier!.owner(),
      this.carrier!,
      target,
    );
    this.activeAircraft.add(aircraft);
    this.mg.addExecution(aircraft);
    if (!target.hasHealth()) {
      // Healthless targets die to a single strike — don't waste more.
      this.alreadyStruck.add(target);
    }
  }

  private patrol(): void {
    const manualDestination = this.carrier!.targetTile();
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
        this.carrier!.tile(),
        this.mg.config().warshipPatrolRange(),
      );
      if (this.patrolDestination === undefined) {
        return;
      }
    }

    this.moveToward(this.patrolDestination, false);
  }

  private moveToward(destination: TileRef, manual: boolean): void {
    const result = this.pathfinder.next(this.carrier!.tile(), destination);
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.carrier!.move(result.node);
        if (manual) {
          // Re-anchor the patrol on the new station so the carrier holds
          // position instead of sailing back to its spawn area.
          this.patrolTile = destination;
          this.carrier!.setTargetTile(undefined);
        } else {
          this.patrolDestination = undefined;
        }
        break;
      case PathStatus.NEXT:
        this.carrier!.move(result.node);
        break;
      case PathStatus.NOT_FOUND:
        if (manual) {
          this.carrier!.setTargetTile(undefined);
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

import { Execution, Game, PlayerType, Unit, UnitType } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { ShellExecution } from "./ShellExecution";
import { TradeShipExecution } from "./TradeShipExecution";
import { TrainStationExecution } from "./TrainStationExecution";

/** Enemy ship types a naval-base port battery will engage. */
const BATTERY_TARGET_TYPES = [
  UnitType.Warship,
  UnitType.AntiAirFrigate,
  UnitType.Submarine,
  UnitType.AircraftCarrier,
] as const;

export class PortExecution implements Execution {
  private active = true;
  private mg: Game;
  private port: Unit;
  private random: PseudoRandom;
  private checkOffset: number;
  private tradeShipSpawnRejections = 0;
  private lastBatteryAttack = 0;

  constructor(port: Unit) {
    this.port = port;
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks());
    this.checkOffset = mg.ticks() % 10;
  }

  tick(ticks: number): void {
    if (this.mg === null || this.random === null || this.checkOffset === null) {
      throw new Error("Not initialized");
    }

    if (!this.port.isActive()) {
      this.active = false;
      return;
    }

    if (this.port.isUnderConstruction()) {
      return;
    }

    if (!this.port.hasTrainStation()) {
      this.createStation();
    }

    if (this.port.portSpecialization() === "naval") {
      this.fireBattery();
    }

    // Only check every 10 ticks for performance.
    if ((this.mg.ticks() + this.checkOffset) % 10 !== 0) {
      return;
    }

    if (!this.shouldSpawnTradeShip()) {
      return;
    }

    const ports = this.tradingPorts();

    if (ports.length === 0) {
      return;
    }

    const port = this.selectTradingPort(ports);
    this.mg.addExecution(
      new TradeShipExecution(this.port.owner(), this.port, port),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  shouldSpawnTradeShip(): boolean {
    const numTradeShips = this.mg.unitCount(UnitType.TradeShip);
    const spawnRate = this.mg
      .config()
      .tradeShipSpawnRate(this.tradeShipSpawnRejections, numTradeShips);
    // Trade hubs roll extra spawn chances, as if leveled higher.
    const tradeBonus =
      this.port!.portSpecialization() === "trade"
        ? this.mg.config().portTradeSpecSpawnBonusLevels()
        : 0;
    for (let i = 0; i < this.port!.level() + tradeBonus; i++) {
      if (this.random.chance(spawnRate)) {
        this.tradeShipSpawnRejections = 0;
        return true;
      }
      this.tradeShipSpawnRejections++;
    }
    return false;
  }

  /**
   * Naval base battery: shell the closest enemy combat ship in range.
   * Submarines are only engageable at their close-range engagement distance,
   * matching warship targeting rules.
   */
  private fireBattery(): void {
    const config = this.mg.config();
    if (
      this.mg.ticks() - this.lastBatteryAttack <
      config.portNavalBatteryAttackRate()
    ) {
      return;
    }

    const owner = this.port.owner();
    const nearby = this.mg.nearbyUnits(
      this.port.tile(),
      config.portNavalBatteryRange(),
      BATTERY_TARGET_TYPES as unknown as UnitType[],
    );

    let best: Unit | undefined;
    let bestDistSquared = Infinity;
    for (const { unit, distSquared } of nearby) {
      if (
        unit.owner() === owner ||
        !owner.canAttackPlayer(unit.owner(), true)
      ) {
        continue;
      }
      if (
        unit.type() === UnitType.Submarine &&
        distSquared > config.submarineEngagementRange() ** 2
      ) {
        continue;
      }
      if (distSquared < bestDistSquared) {
        best = unit;
        bestDistSquared = distSquared;
      }
    }

    if (best === undefined) return;
    this.lastBatteryAttack = this.mg.ticks();
    this.mg.addExecution(
      new ShellExecution(this.port.tile(), owner, this.port, best),
    );
  }

  createStation(): void {
    const nearbyFactory = this.mg.hasUnitNearby(
      this.port.tile()!,
      this.mg.config().trainStationMaxRange(),
      UnitType.Factory,
    );
    if (nearbyFactory) {
      this.mg.addExecution(new TrainStationExecution(this.port));
    }
  }

  // It's a probability list, so if an element appears twice it's because it's
  // twice more likely to be picked later.
  tradingPorts(): Unit[] {
    const sourceComponents = new Set<number>();
    for (const neighbor of this.mg.neighbors(this.port!.tile())) {
      if (!this.mg.isWater(neighbor)) continue;
      const comp = this.mg.getWaterComponent(neighbor);
      if (comp !== null) sourceComponents.add(comp);
    }
    const ports = this.mg
      .players()
      .filter((p) => p !== this.port!.owner() && p.canTrade(this.port!.owner()))
      .flatMap((p) => p.units(UnitType.Port))
      .filter((p) => {
        for (const comp of sourceComponents) {
          if (this.mg.hasWaterComponent(p.tile(), comp)) return true;
        }
        return false;
      })
      .sort((p1, p2) => {
        return (
          this.mg.manhattanDist(this.port!.tile(), p1.tile()) -
          this.mg.manhattanDist(this.port!.tile(), p2.tile())
        );
      });

    const weightedPorts: Unit[] = [];

    for (const [i, otherPort] of ports.entries()) {
      const expanded = new Array(otherPort.level()).fill(otherPort);
      weightedPorts.push(...expanded);
      if (otherPort.portSpecialization() === "trade") {
        // Trade hubs attract commerce: count them again as a destination.
        weightedPorts.push(...expanded);
      }
      const tooClose =
        this.mg.manhattanDist(this.port!.tile(), otherPort.tile()) <
        this.mg.config().tradeShipShortRangeDebuff();
      const closeBonus =
        i < this.mg.config().proximityBonusPortsNb(ports.length);
      if (!tooClose && closeBonus) {
        // If the port is close, but not too close, add it again
        // to increase the chances of trading with it.
        weightedPorts.push(...expanded);
      }
      if (!tooClose && this.port!.owner().isFriendly(otherPort.owner())) {
        weightedPorts.push(...expanded);
      }
    }
    return weightedPorts;
  }

  /**
   * Human ports retain varied weighted routing. Nations instead maximize
   * estimated income per travel tick, including alliance and trade-hub bonuses.
   */
  selectTradingPort(ports: Unit[]): Unit {
    if (this.port.owner().type() !== PlayerType.Nation) {
      return this.random.randElement(ports);
    }

    const uniquePorts = Array.from(new Set(ports));
    uniquePorts.sort((a, b) => {
      const valueDelta =
        this.estimatedIncomeRate(b) - this.estimatedIncomeRate(a);
      return valueDelta || a.id() - b.id();
    });
    return uniquePorts[0];
  }

  private estimatedIncomeRate(destination: Unit): number {
    const owner = this.port.owner();
    const distance = Math.max(
      1,
      this.mg.manhattanDist(this.port.tile(), destination.tile()),
    );
    let income = Number(this.mg.config().tradeShipGold(distance, owner));
    income *= 1 + this.mg.config().portLevelTradeGoldBonus(destination.level());
    if (destination.portSpecialization() === "trade") {
      income *= 1 + this.mg.config().portTradeSpecGoldBonus();
    }
    if (
      owner.isFriendly(destination.owner()) ||
      destination.owner().isFriendly(owner)
    ) {
      income *= 1 + this.mg.config().alliedTradeGoldBonus();
    }
    return income / distance;
  }
}

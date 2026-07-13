import { Difficulty, Game, Player, Unit, UnitType } from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { ConstructionExecution } from "../ConstructionExecution";
import { nationDifficulty } from "../utils/NationDifficulty";

interface FleetPlan {
  submarines: number;
  carriers: number;
  antiAirFrigates: number;
  navalMines: number;
}

const ENEMY_NAVAL_TYPES = [
  UnitType.Warship,
  UnitType.Submarine,
  UnitType.AircraftCarrier,
  UnitType.AntiAirFrigate,
  UnitType.Aircraft,
  UnitType.TransportShip,
  UnitType.TradeShip,
] as const;

/**
 * Complements NationWarshipBehavior with a threat-driven mixed fleet.
 * Autonomous craft are covered elsewhere: ports launch trade ships, carriers
 * launch aircraft, factories launch trains, and land attacks create transports.
 */
export class NationFleetBehavior {
  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  desiredFleet(): FleetPlan {
    const enemies = this.enemyNavalUnits();
    const count = (type: UnitType) =>
      enemies.filter((unit) => unit.type() === type).length;
    const surfaceThreat =
      count(UnitType.Warship) +
      count(UnitType.AntiAirFrigate) +
      count(UnitType.AircraftCarrier);
    const airThreat =
      count(UnitType.AircraftCarrier) + count(UnitType.Aircraft);
    const submarineThreat = count(UnitType.Submarine);
    const merchantTargets =
      count(UnitType.TradeShip) + count(UnitType.TransportShip);
    const hasObjective = this.game.maritimeZone() !== null;
    const impossible = nationDifficulty(this.game) === Difficulty.Impossible;

    return {
      submarines:
        merchantTargets + surfaceThreat > 0 || hasObjective
          ? Math.min(
              impossible ? 3 : 2,
              Math.max(1, Math.ceil(merchantTargets / 3)),
            )
          : 0,
      carriers:
        surfaceThreat >= 2 || hasObjective
          ? impossible && surfaceThreat >= 5
            ? 2
            : 1
          : 0,
      antiAirFrigates:
        airThreat > 0 ? Math.min(impossible ? 2 : 1, airThreat) : 0,
      navalMines: submarineThreat > 0 ? Math.min(4, submarineThreat) : 0,
    };
  }

  buildStrategicFleet(): boolean {
    if (this.player.isBankrupt() || this.player.debt() > 0n) return false;
    if (this.player.units(UnitType.Port).length === 0) return false;

    const plan = this.desiredFleet();
    const priorities: Array<[UnitType, number]> = [
      [UnitType.AntiAirFrigate, plan.antiAirFrigates],
      [UnitType.NavalMine, plan.navalMines],
      [UnitType.Submarine, plan.submarines],
      [UnitType.AircraftCarrier, plan.carriers],
    ];

    for (const [type, desired] of priorities) {
      if (this.player.units(type).length >= desired) continue;
      if (this.tryBuild(type)) return true;
    }
    return false;
  }

  private tryBuild(type: UnitType): boolean {
    if (this.game.config().isUnitDisabled(type)) return false;
    const cost = this.game.unitInfo(type).cost(this.game, this.player);
    if (this.player.gold() < cost * 2n) return false;

    const target = this.findNavalTarget(type);
    if (target === null || this.player.canBuild(type, target) === false) {
      return false;
    }
    this.game.addExecution(
      new ConstructionExecution(this.player, type, target),
    );
    return true;
  }

  private findNavalTarget(type: UnitType): TileRef | null {
    const zone = this.game.maritimeZone();
    if (type !== UnitType.NavalMine && zone !== null) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const tile = zone.randomPatrolTile(this.random);
        if (this.player.canBuild(type, tile) !== false) return tile;
      }
    }

    for (const enemy of this.enemyNavalUnits()) {
      if (this.player.canBuild(type, enemy.tile()) !== false) {
        return enemy.tile();
      }
    }

    for (const port of this.player.units(UnitType.Port)) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const x = this.random.nextInt(
          this.game.x(port.tile()) - 80,
          this.game.x(port.tile()) + 80,
        );
        const y = this.random.nextInt(
          this.game.y(port.tile()) - 80,
          this.game.y(port.tile()) + 80,
        );
        if (!this.game.isValidCoord(x, y)) continue;
        const tile = this.game.ref(x, y);
        if (
          this.game.isWater(tile) &&
          this.player.canBuild(type, tile) !== false
        ) {
          return tile;
        }
      }
    }
    return null;
  }

  private enemyNavalUnits(): Unit[] {
    return this.game
      .units(...ENEMY_NAVAL_TYPES)
      .filter(
        (unit) =>
          unit.isActive() &&
          unit.owner() !== this.player &&
          !this.player.isFriendly(unit.owner(), true),
      );
  }
}

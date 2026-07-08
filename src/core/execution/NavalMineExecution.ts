import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";

const MINE_TARGET_TYPES = [
  UnitType.Warship,
  UnitType.TransportShip,
  UnitType.Submarine,
  UnitType.AircraftCarrier,
] as const;

export class NavalMineExecution implements Execution {
  private active = true;
  private mg: Game;
  private mine: Unit | undefined;

  constructor(
    private player: Player,
    private tile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;

    const spawn = this.player.canBuild(UnitType.NavalMine, this.tile);
    if (spawn === false) {
      this.active = false;
      return;
    }

    this.mine = this.player.buildUnit(UnitType.NavalMine, spawn, {});
  }

  tick(ticks: number): void {
    if (this.mine === undefined || !this.mine.isActive()) {
      this.active = false;
      return;
    }

    const config = this.mg.config();
    const detectionRange = config.navalMineDetectionRange();
    const blastRange = config.navalMineBlastRange();
    const detectionRangeSquared = detectionRange ** 2;
    const blastRangeSquared = blastRange ** 2;
    const nearbyTargets = this.mg.nearbyUnits(
      this.mine.tile(),
      Math.max(detectionRange, blastRange),
      MINE_TARGET_TYPES,
    );

    const triggered = nearbyTargets.some(
      ({ unit, distSquared }) =>
        distSquared <= detectionRangeSquared && this.canHit(unit),
    );

    if (!triggered) {
      return;
    }

    for (const { unit, distSquared } of nearbyTargets) {
      if (distSquared <= blastRangeSquared && this.canHit(unit)) {
        unit.delete(true, this.mine.owner());
      }
    }

    if (this.mine.isActive()) {
      this.mine.delete(false);
    }
    this.active = false;
  }

  private canHit(unit: Unit): boolean {
    return (
      this.mine !== undefined &&
      unit.isActive() &&
      this.mine.owner().canAttackPlayer(unit.owner(), true)
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

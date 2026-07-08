import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";

/**
 * Carrier strike aircraft: flies in a straight line toward its target,
 * ignoring terrain entirely (unlike torpedoes, which swim through water).
 * Deals flat, deterministic damage on impact.
 */
export class AircraftExecution implements Execution {
  private active = true;
  private mg: Game;
  private aircraft: Unit | undefined;
  private destroyAtTick = -1;

  constructor(
    private spawn: TileRef,
    private _owner: Player,
    private ownerUnit: Unit,
    private target: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    this.aircraft ??= this._owner.buildUnit(UnitType.Aircraft, this.spawn, {});
    if (!this.aircraft.isActive()) {
      this.active = false;
      return;
    }
    if (
      !this.target.isActive() ||
      this.target.owner() === this.aircraft.owner() ||
      (this.destroyAtTick !== -1 && this.mg.ticks() >= this.destroyAtTick)
    ) {
      this.aircraft.delete(false);
      this.active = false;
      return;
    }

    if (this.destroyAtTick === -1 && !this.ownerUnit.isActive()) {
      this.destroyAtTick = this.mg.ticks() + this.mg.config().aircraftLifetime();
    }

    const stepsPerTick = this.mg.config().aircraftStepsPerTick();
    for (let i = 0; i < stepsPerTick; i++) {
      const current = this.aircraft.tile();
      const targetTile = this.target.tile();
      if (current === targetTile) {
        this.strike();
        return;
      }
      this.aircraft.move(this.stepToward(current, targetTile));
      if (this.aircraft.tile() === targetTile) {
        this.strike();
        return;
      }
    }
  }

  /** One deterministic straight-line step: advance along the dominant axis. */
  private stepToward(current: TileRef, targetTile: TileRef): TileRef {
    const dx = this.mg.x(targetTile) - this.mg.x(current);
    const dy = this.mg.y(targetTile) - this.mg.y(current);
    let x = this.mg.x(current);
    let y = this.mg.y(current);
    if (Math.abs(dx) >= Math.abs(dy)) {
      x += Math.sign(dx);
    } else {
      y += Math.sign(dy);
    }
    return this.mg.ref(x, y);
  }

  private strike(): void {
    const { damage } = this.mg.config().unitInfo(UnitType.Aircraft);
    this.target.modifyHealth(-(damage ?? 200), this._owner);
    this.aircraft!.setReachedTarget();
    this.aircraft!.delete(false);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

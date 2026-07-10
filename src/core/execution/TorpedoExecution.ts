import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PathFinding } from "../pathfinding/PathFinder";
import { PathStatus, SteppingPathFinder } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";

export class TorpedoExecution implements Execution {
  private active = true;
  private pathFinder: SteppingPathFinder<TileRef>;
  private torpedo: Unit | undefined;
  private mg: Game;
  private destroyAtTick: number = -1;
  private random: PseudoRandom;

  constructor(
    private spawn: TileRef,
    private _owner: Player,
    private ownerUnit: Unit,
    private target: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.pathFinder = PathFinding.Water(mg);
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks());
  }

  tick(ticks: number): void {
    this.torpedo ??= this._owner.buildUnit(UnitType.Torpedo, this.spawn, {});
    if (!this.torpedo.isActive()) {
      this.active = false;
      return;
    }
    if (
      !this.target.isActive() ||
      this.target.owner() === this.torpedo.owner() ||
      (this.destroyAtTick !== -1 && this.mg.ticks() >= this.destroyAtTick)
    ) {
      this.torpedo.delete(false);
      this.active = false;
      return;
    }

    if (this.destroyAtTick === -1 && !this.ownerUnit.isActive()) {
      this.destroyAtTick = this.mg.ticks() + this.mg.config().torpedoLifetime();
    }

    const stepsPerTick = this.mg.config().torpedoStepsPerTick();
    for (let i = 0; i < stepsPerTick; i++) {
      const result = this.pathFinder.next(
        this.torpedo.tile(),
        this.target.tile(),
      );
      if (result.status === PathStatus.COMPLETE) {
        this.active = false;
        this.target.modifyHealth(-this.effectOnTarget(), this._owner);
        this.torpedo.setReachedTarget();
        this.torpedo.delete(false);
        return;
      } else if (result.status === PathStatus.NEXT) {
        this.torpedo.move(result.node);
      } else {
        this.torpedo.delete(false);
        this.active = false;
        return;
      }
    }
  }

  private effectOnTarget(): number {
    const { damage } = this.mg.config().unitInfo(UnitType.Torpedo);
    const baseDamage = damage ?? 250;

    const roll = this.random.nextInt(1, 6);
    const damageMultiplier = (roll - 1) * 25 + 200;

    return Math.round((baseDamage / 250) * damageMultiplier);
  }

  public getEffectOnTargetForTesting(): number {
    return this.effectOnTarget();
  }

  isActive(): boolean {
    return this.active;
  }
  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

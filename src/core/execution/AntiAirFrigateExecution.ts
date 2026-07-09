import {
  Execution,
  Game,
  isUnit,
  OwnerComp,
  Unit,
  UnitParams,
  UnitType,
} from "../game/Game";
import { WarshipExecution } from "./WarshipExecution";

type AntiAirFrigateInput =
  | (UnitParams<UnitType.AntiAirFrigate> & OwnerComp)
  | Unit;

export class AntiAirFrigateExecution implements Execution {
  private active = true;
  private mg: Game;
  private frigate: Unit | undefined;
  private warshipExecution: WarshipExecution | undefined;
  private lastAntiAirAttack = 0;

  constructor(private input: AntiAirFrigateInput) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (isUnit(this.input)) {
      this.frigate = this.input;
    } else {
      const spawn = this.input.owner.canBuild(
        UnitType.AntiAirFrigate,
        this.input.patrolTile,
      );
      if (spawn === false) {
        console.warn(
          `Failed to spawn anti-air frigate for ${this.input.owner.name()} at ${this.input.patrolTile}`,
        );
        this.active = false;
        return;
      }
      this.frigate = this.input.owner.buildUnit(
        UnitType.AntiAirFrigate,
        spawn,
        this.input,
      );
    }

    this.warshipExecution = new WarshipExecution(this.frigate);
    this.warshipExecution.init(mg, ticks);
  }

  tick(ticks: number): void {
    if (this.frigate === undefined || !this.frigate.isActive()) {
      this.active = false;
      return;
    }

    this.interceptAircraft();
    this.warshipExecution?.tick(ticks);
  }

  private interceptAircraft(): void {
    const attackRate = this.mg.config().antiAirFrigateAttackRate();
    if (this.mg.ticks() - this.lastAntiAirAttack <= attackRate) {
      return;
    }

    const target = this.mg
      .nearbyUnits(
        this.frigate!.tile(),
        this.mg.config().antiAirFrigateRange(),
        UnitType.Aircraft,
      )
      .find(
        ({ unit }) =>
          unit.owner() !== this.frigate!.owner() &&
          this.frigate!.owner().canAttackPlayer(unit.owner(), true),
      )?.unit;

    if (target === undefined) {
      return;
    }

    this.lastAntiAirAttack = this.mg.ticks();
    this.frigate!.updateWarshipState({ isInCombat: true });
    target.delete(false, this.frigate!.owner());
  }

  isActive(): boolean {
    return this.active && (this.frigate?.isActive() ?? true);
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

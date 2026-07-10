import { Execution, Game, Player, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";

const MANUALLY_MOVABLE_NAVAL_UNITS = [
  UnitType.Warship,
  UnitType.Submarine,
  UnitType.AircraftCarrier,
  UnitType.AntiAirFrigate,
] as const;

export class MoveWarshipExecution implements Execution {
  constructor(
    private readonly owner: Player,
    private readonly unitIds: number[],
    private readonly position: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    if (!mg.isValidRef(this.position)) {
      console.warn(`MoveWarshipExecution: position ${this.position} not valid`);
      return;
    }

    const targetWaterComponent = mg.getWaterComponent(this.position);
    if (targetWaterComponent === null) {
      return;
    }

    const movableUnits = new Map(
      this.owner
        .units(...(MANUALLY_MOVABLE_NAVAL_UNITS as unknown as UnitType[]))
        .map((u) => [u.id(), u]),
    );

    for (const unitId of new Set(this.unitIds)) {
      const unit = movableUnits.get(unitId);
      if (!unit) {
        console.warn(`MoveWarshipExecution: naval unit ${unitId} not found`);
        continue;
      }
      if (!unit.isActive()) {
        console.warn(`MoveWarshipExecution: naval unit ${unitId} is not active`);
        continue;
      }
      if (!mg.hasWaterComponent(unit.tile(), targetWaterComponent)) {
        continue;
      }

      unit.setTargetUnit(undefined);
      if (
        unit.type() === UnitType.Warship ||
        unit.type() === UnitType.AntiAirFrigate
      ) {
        // A manual move order overrides escort duty.
        unit.updateWarshipState({
          patrolTile: this.position,
          escortUnitId: undefined,
        });
        unit.setTargetTile(undefined);
      } else {
        unit.setTargetTile(this.position);
      }
    }
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

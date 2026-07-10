import {
  Execution,
  Game,
  Player,
  PortSpecialization,
  UnitType,
} from "../game/Game";

/**
 * SpecializePortExecution — gives a port its identity.
 *
 * One-shot and irreversible: a port at or above the minimum level, still
 * unspecialized, becomes a trade hub, naval base, or harbor watch. The
 * ongoing effects live where each system already runs (PortExecution,
 * TradeShipExecution, WarshipExecution).
 */
export class SpecializePortExecution implements Execution {
  constructor(
    private readonly owner: Player,
    private readonly unitId: number,
    private readonly specialization: PortSpecialization,
  ) {}

  init(mg: Game, _ticks: number): void {
    const port = mg.unit(this.unitId);
    if (
      port === undefined ||
      !port.isActive() ||
      port.type() !== UnitType.Port
    ) {
      console.warn(`SpecializePortExecution: port ${this.unitId} not found`);
      return;
    }
    if (port.owner() !== this.owner) {
      console.warn(
        `SpecializePortExecution: port ${this.unitId} not owned by player`,
      );
      return;
    }
    if (port.isUnderConstruction()) {
      console.warn(
        `SpecializePortExecution: port ${this.unitId} under construction`,
      );
      return;
    }
    if (port.portSpecialization() !== undefined) {
      console.warn(
        `SpecializePortExecution: port ${this.unitId} already specialized`,
      );
      return;
    }
    if (port.level() < mg.config().portSpecializationMinLevel()) {
      console.warn(
        `SpecializePortExecution: port ${this.unitId} below minimum level`,
      );
      return;
    }

    port.setPortSpecialization(this.specialization);
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

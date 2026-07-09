import { Execution, Game, Player, UnitType } from "../game/Game";

/**
 * EscortTradeExecution — assigns selected warships to escort a trade ship.
 *
 * One-shot: it only stamps `escortUnitId` on each warship's state; the
 * ongoing convoy behavior (moving patrol anchor, engagement, release when
 * the voyage ends) lives in WarshipExecution.handleEscort().
 *
 * The convoy may be the player's own or an ally's — escorting friendly
 * commerce is how allies protect each other's economy.
 */
export class EscortTradeExecution implements Execution {
  constructor(
    private readonly owner: Player,
    private readonly unitIds: number[],
    private readonly targetUnitId: number,
  ) {}

  init(mg: Game, _ticks: number): void {
    const target = mg.unit(this.targetUnitId);
    if (
      target === undefined ||
      !target.isActive() ||
      target.type() !== UnitType.TradeShip
    ) {
      console.warn(
        `EscortTradeExecution: trade ship ${this.targetUnitId} not found`,
      );
      return;
    }
    if (
      target.owner() !== this.owner &&
      !target.owner().isFriendly(this.owner)
    ) {
      console.warn(
        `EscortTradeExecution: trade ship ${this.targetUnitId} is not friendly`,
      );
      return;
    }

    const warships = new Map(
      this.owner.units(UnitType.Warship).map((u) => [u.id(), u]),
    );
    const targetComponent = mg.getWaterComponent(target.tile());

    for (const unitId of new Set(this.unitIds)) {
      const warship = warships.get(unitId);
      if (warship === undefined || !warship.isActive()) {
        console.warn(`EscortTradeExecution: warship ${unitId} not found`);
        continue;
      }
      if (
        targetComponent !== null &&
        !mg.hasWaterComponent(warship.tile(), targetComponent)
      ) {
        continue;
      }

      warship.setTargetUnit(undefined);
      warship.setTargetTile(undefined);
      warship.updateWarshipState({
        escortUnitId: target.id(),
        patrolTile: target.tile(),
      });
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

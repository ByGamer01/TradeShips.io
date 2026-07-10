import {
  Execution,
  Game,
  MessageType,
  Player,
  PlayerID,
  UnitType,
} from "../game/Game";

/**
 * One-shot purchase: the buyer pays gold to impose a tariff on an enemy.
 * While active (see Config.tariffDurationTicks) the buyer collects a cut of
 * the target's trade-arrival gold — applied in TradeShipExecution.complete().
 */
export class TariffExecution implements Execution {
  private active = true;

  private mg: Game;
  private target: Player | null = null;

  constructor(
    private player: Player,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _: number): void {
    this.mg = mg;
    if (!mg.hasPlayer(this.targetID)) {
      console.warn(`TariffExecution target ${this.targetID} not found`);
      this.active = false;
      return;
    }
    this.target = mg.player(this.targetID);
  }

  tick(ticks: number): void {
    this.active = false;
    const target = this.target;
    if (target === null) return;
    if (target === this.player || this.player.isFriendly(target)) {
      return;
    }
    if (!this.hasActiveCongress()) {
      return;
    }

    const cost = this.mg.config().tariffCost();
    if (this.player.gold() < cost) {
      return;
    }

    this.player.removeGold(cost);
    this.player.addTariffAgainst(
      target,
      ticks + this.mg.config().tariffDurationTicks(),
    );

    this.mg.displayMessage(
      "events_display.tariff_imposed",
      MessageType.TARIFF_IMPOSED,
      this.player.id(),
      undefined,
      { name: target.displayName() },
    );
    this.mg.displayMessage(
      "events_display.tariff_imposed_on_you",
      MessageType.TARIFF_IMPOSED,
      target.id(),
      undefined,
      { name: this.player.displayName() },
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private hasActiveCongress(): boolean {
    return this.player
      .units(UnitType.Congress)
      .some((unit) => unit.isActive() && !unit.isUnderConstruction());
  }
}

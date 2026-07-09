import { Execution, Game, MessageType, UnitType } from "../game/Game";

/**
 * Recurring global economic event: every MISSION_INTERVAL_TICKS, every
 * player with at least one active port receives a gold bonus and the whole
 * match is notified via a global (playerID: null) announcement. This is the
 * "global economic mission" — not tied to any single player's intent, added
 * once at game start like WinCheckExecution.
 */
export class EconomicMissionExecution implements Execution {
  // 4 minutes at 10 ticks/second.
  static readonly MISSION_INTERVAL_TICKS = 2400;
  static readonly GOLD_BONUS_PER_PORT = 250n;

  private active = true;
  private mg: Game | null = null;

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.mg === null) throw new Error("Not initialized");
    if (
      ticks === 0 ||
      ticks % EconomicMissionExecution.MISSION_INTERVAL_TICKS !== 0
    ) {
      return;
    }
    this.startMission();
  }

  private startMission(): void {
    const mg = this.mg!;
    let rewardedTraders = 0;
    for (const player of mg.players()) {
      if (!player.isAlive()) continue;
      const activePorts = player
        .units(UnitType.Port)
        .filter((u) => u.isActive());
      if (activePorts.length === 0) continue;
      const bonus =
        EconomicMissionExecution.GOLD_BONUS_PER_PORT *
        BigInt(activePorts.length);
      player.addGold(bonus, activePorts[0].tile());
      rewardedTraders++;
    }
    if (rewardedTraders === 0) return;
    mg.displayMessage(
      "events_display.economic_mission_started",
      MessageType.ECONOMIC_MISSION_STARTED,
      null,
      undefined,
      { count: rewardedTraders },
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

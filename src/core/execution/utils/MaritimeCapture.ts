import { Game, GameMode, Player, Team, Unit, UnitType } from "../../game/Game";
import { MaritimeObjectiveStatus } from "../../game/GameUpdates";

/**
 * Shared sustained-capture machinery for maritime objectives (the Team-mode
 * circle and the FFA trade-lane corridor). Both executions aggregate naval
 * power over a zone and step the same state machine: contested ties freeze
 * progress, a rival leader drains the holder before capturing, and control
 * completes at 100%.
 */

export type MaritimeController = Player | Team;

export const NAVAL_CAPTURE_POWER = new Map<UnitType, number>([
  [UnitType.TransportShip, 1],
  [UnitType.TradeShip, 1],
  [UnitType.Warship, 3],
  [UnitType.Submarine, 3],
  [UnitType.AntiAirFrigate, 3],
  [UnitType.AircraftCarrier, 6],
  [UnitType.Aircraft, 1],
]);

export const CAPTURE_RATE_PER_POWER_PER_TICK = 0.02;
// Effective capture power is the leader's advantage over the runner-up,
// clamped to this cap: past it, extra hulls win battles but not the clock.
export const CAPTURE_POWER_CAP = 12;
export const CONTROLLED_PERCENT = 100;

export interface NavalPowerEntry {
  controller: MaritimeController;
  power: number;
}

export interface CaptureState {
  controller: MaritimeController | null;
  leader: MaritimeController | null;
  controlPercent: number;
  status: MaritimeObjectiveStatus;
}

export function newCaptureState(): CaptureState {
  return {
    controller: null,
    leader: null,
    controlPercent: 0,
    status: "neutral",
  };
}

export function controllerKey(controller: MaritimeController): string {
  return typeof controller === "string"
    ? `team:${controller}`
    : `player:${controller.smallID()}`;
}

export function sameController(
  a: MaritimeController | null,
  b: MaritimeController | null,
): boolean {
  if (a === null || b === null) return a === b;
  return controllerKey(a) === controllerKey(b);
}

export function wireController(controller: MaritimeController | null): {
  smallID: number;
  team: Team | null;
} {
  if (controller === null) return { smallID: 0, team: null };
  if (typeof controller === "string") return { smallID: 0, team: controller };
  return { smallID: controller.smallID(), team: null };
}

/** Team in team games, the player itself otherwise. */
export function controllerFor(mg: Game, player: Player): MaritimeController {
  if (mg.config().gameConfig().gameMode === GameMode.Team) {
    return player.team() ?? player;
  }
  return player;
}

/**
 * Sum naval capture power per controller over the units inside the zone,
 * sorted by power descending with a deterministic key tie-break.
 */
export function aggregateNavalPower(
  mg: Game,
  isInside: (unit: Unit) => boolean,
): NavalPowerEntry[] {
  const powerByKey = new Map<string, NavalPowerEntry>();

  for (const unit of mg.units(...NAVAL_CAPTURE_POWER.keys())) {
    if (!unit.isActive() || !isInside(unit)) continue;
    const power = NAVAL_CAPTURE_POWER.get(unit.type()) ?? 0;
    const controller = controllerFor(mg, unit.owner());
    const key = controllerKey(controller);
    const current = powerByKey.get(key);
    if (current === undefined) {
      powerByKey.set(key, { controller, power });
    } else {
      current.power += power;
    }
  }

  return Array.from(powerByKey.values()).sort(
    (a, b) =>
      b.power - a.power ||
      controllerKey(a.controller).localeCompare(controllerKey(b.controller)),
  );
}

/**
 * Advance the sustained-capture state machine one tick given the sorted
 * naval power ranking. Mutates `state` in place.
 */
export function stepCapture(
  state: CaptureState,
  navalPower: readonly NavalPowerEntry[],
): void {
  const top = navalPower[0];
  const second = navalPower[1];

  if (top === undefined) {
    state.leader = null;
    state.status = state.controlPercent > 0 ? "capturing" : "neutral";
    return;
  }

  // Only each side's first CAPTURE_POWER_CAP of power counts toward the
  // clock: extra hulls win battles, not the capture. The rate then scales
  // with the leader's effective margin, so any rival presence slows it and
  // a capped defender freezes any spam outright.
  const effectiveTop = Math.min(top.power, CAPTURE_POWER_CAP);
  const effectiveSecond = Math.min(second?.power ?? 0, CAPTURE_POWER_CAP);

  if (effectiveTop === effectiveSecond) {
    state.leader = null;
    state.status = "contested";
    return;
  }

  state.leader = top.controller;
  const delta =
    (effectiveTop - effectiveSecond) * CAPTURE_RATE_PER_POWER_PER_TICK;

  if (state.controller !== null && !sameController(state.controller, top.controller)) {
    state.controlPercent = Math.max(0, state.controlPercent - delta);
    if (state.controlPercent === 0) {
      state.controller = top.controller;
    }
  } else {
    state.controller = top.controller;
    state.controlPercent = Math.min(
      CONTROLLED_PERCENT,
      state.controlPercent + delta,
    );
  }

  state.status =
    state.controlPercent >= CONTROLLED_PERCENT ? "controlled" : "capturing";
}

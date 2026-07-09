import type { MaritimeObjectiveUpdate } from "../../../../core/game/GameUpdates";
import type { MaritimeObjectiveData, UnitState } from "../../types";
import {
  UT_AIRCRAFT,
  UT_ANTI_AIR_FRIGATE,
  UT_CARRIER,
  UT_SUBMARINE,
  UT_TRADE_SHIP,
  UT_TRANSPORT,
  UT_WARSHIP,
} from "../../types";

export type { MaritimeObjectiveData };

export interface MaritimeObjectiveOptions {
  mapWidth: number;
  mapHeight: number;
  isWater: (tile: number) => boolean;
  teamForOwner?: (ownerID: number) => string | null | undefined;
  previous?: MaritimeObjectiveData;
}

const OBJECTIVE_NAMES = [
  "Silk Route",
  "Pearl Strait",
  "Golden Passage",
  "Storm Channel",
  "Dragon Sea",
  "Imperial Route",
  "Coral Passage",
] as const;

const OBJECTIVE_RADIUS_RATIO = 0.09;
const MIN_OBJECTIVE_RADIUS = 12;
const MAX_OBJECTIVE_RADIUS = 32;
const WATER_SEARCH_RADIUS = 48;
const CAPTURE_RATE_PER_POWER_PER_TICK = 0.02;

const NAVAL_CAPTURE_POWER: ReadonlyMap<string, number> = new Map([
  [UT_TRANSPORT, 1],
  [UT_TRADE_SHIP, 1],
  [UT_WARSHIP, 3],
  [UT_SUBMARINE, 3],
  [UT_ANTI_AIR_FRIGATE, 3],
  [UT_CARRIER, 6],
  [UT_AIRCRAFT, 1],
]);

function tileAt(mapWidth: number, mapHeight: number, x: number, y: number) {
  const clampedX = Math.max(0, Math.min(mapWidth - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(mapHeight - 1, Math.round(y)));
  return clampedY * mapWidth + clampedX;
}

function coords(tile: number, mapWidth: number) {
  const x = tile % mapWidth;
  return { x, y: (tile - x) / mapWidth };
}

function distance(a: number, b: number, mapWidth: number): number {
  const ca = coords(a, mapWidth);
  const cb = coords(b, mapWidth);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

function nearestWaterTile(
  tile: number,
  mapWidth: number,
  mapHeight: number,
  isWater: (tile: number) => boolean,
): number {
  if (isWater(tile)) return tile;

  const center = coords(tile, mapWidth);
  for (let radius = 1; radius <= WATER_SEARCH_RADIUS; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue;
        const candidate = y * mapWidth + x;
        if (isWater(candidate)) return candidate;
      }
    }
  }

  return tile;
}

function objectiveRadius(mapWidth: number, mapHeight: number): number {
  const radius = Math.round(
    Math.min(mapWidth, mapHeight) * OBJECTIVE_RADIUS_RATIO,
  );
  return Math.max(MIN_OBJECTIVE_RADIUS, Math.min(MAX_OBJECTIVE_RADIUS, radius));
}

function objectiveName(center: number): string {
  return OBJECTIVE_NAMES[Math.abs(center) % OBJECTIVE_NAMES.length];
}

interface PowerEntry {
  ownerID: number;
  team: string | null;
  power: number;
}

function navalPowerKey(ownerID: number, team: string | null): string {
  return team === null ? `player:${ownerID}` : `team:${team}`;
}

function navalPowerInZone(
  units: ReadonlyMap<number, UnitState>,
  center: number,
  radius: number,
  mapWidth: number,
  teamForOwner?: (ownerID: number) => string | null | undefined,
): PowerEntry[] {
  const powerByController = new Map<string, PowerEntry>();
  for (const unit of units.values()) {
    if (!unit.isActive) continue;
    const power = NAVAL_CAPTURE_POWER.get(unit.unitType);
    if (power === undefined) continue;
    if (distance(unit.pos, center, mapWidth) > radius) continue;
    const team = teamForOwner?.(unit.ownerID) ?? null;
    const key = navalPowerKey(unit.ownerID, team);
    const current = powerByController.get(key);
    if (current === undefined) {
      powerByController.set(key, { ownerID: unit.ownerID, team, power });
    } else {
      current.power += power;
      current.ownerID = Math.min(current.ownerID, unit.ownerID);
    }
  }
  return Array.from(powerByController.values());
}

function sortedPower(powerByOwner: readonly PowerEntry[]) {
  return [...powerByOwner].sort(
    (a, b) => b.power - a.power || a.ownerID - b.ownerID,
  );
}

function nextProgress(
  previous: MaritimeObjectiveData | undefined,
  leaderID: number,
  leaderTeam: string | null,
  leaderPower: number,
): number {
  if (leaderID === 0) return previous?.controlPercent ?? 0;
  const delta = leaderPower * CAPTURE_RATE_PER_POWER_PER_TICK;
  const sameController =
    previous === undefined ||
    previous.controlPercent <= 0 ||
    (leaderTeam !== null
      ? previous.controllerTeam === leaderTeam
      : previous.controllerID === leaderID);
  if (!sameController) {
    return Math.max(0, previous.controlPercent - delta);
  }
  return Math.min(100, (previous?.controlPercent ?? 0) + delta);
}

/**
 * Maps the authoritative core update to renderer objective data. Preferred
 * over deriveMaritimeObjective whenever the simulation emits it; the derived
 * path remains as fallback for replays recorded before the update existed.
 */
export function maritimeObjectiveFromUpdate(
  update: Omit<MaritimeObjectiveUpdate, "type">,
): MaritimeObjectiveData {
  return {
    name: objectiveName(update.center),
    shape: update.shape ?? "circle",
    center: update.center,
    radius: update.radius,
    path: update.path,
    laneHalfWidth: update.laneHalfWidth,
    controllerID: update.controllerSmallID,
    controllerTeam: update.controllerTeam,
    leaderID: update.leaderSmallID,
    leaderTeam: update.leaderTeam,
    controlPercent: update.controlPercent,
    status: update.status,
    navalPower: update.navalPower.map((entry) => ({
      ownerID: entry.smallID,
      team: entry.team,
      power: entry.power,
    })),
  };
}

export function deriveMaritimeObjective(
  units: ReadonlyMap<number, UnitState>,
  options: MaritimeObjectiveOptions,
): MaritimeObjectiveData {
  const center = nearestWaterTile(
    tileAt(
      options.mapWidth,
      options.mapHeight,
      options.mapWidth / 2,
      options.mapHeight / 2,
    ),
    options.mapWidth,
    options.mapHeight,
    options.isWater,
  );
  const radius = objectiveRadius(options.mapWidth, options.mapHeight);
  const power = sortedPower(
    navalPowerInZone(
      units,
      center,
      radius,
      options.mapWidth,
      options.teamForOwner,
    ),
  );
  const top = power[0];
  const second = power[1];
  const contested =
    top !== undefined && second !== undefined && top.power === second.power;

  if (top === undefined) {
    return {
      name: objectiveName(center),
      center,
      radius,
      controllerID: options.previous?.controllerID ?? 0,
      controllerTeam: options.previous?.controllerTeam ?? null,
      leaderID: 0,
      leaderTeam: null,
      controlPercent: options.previous?.controlPercent ?? 0,
      status:
        (options.previous?.controlPercent ?? 0) > 0 ? "capturing" : "neutral",
      navalPower: [],
    };
  }

  if (contested) {
    return {
      name: objectiveName(center),
      center,
      radius,
      controllerID: options.previous?.controllerID ?? 0,
      controllerTeam: options.previous?.controllerTeam ?? null,
      leaderID: 0,
      leaderTeam: null,
      controlPercent: options.previous?.controlPercent ?? 0,
      status: "contested",
      navalPower: power,
    };
  }

  const controlPercent = nextProgress(
    options.previous,
    top.ownerID,
    top.team,
    top.power,
  );
  const status = controlPercent >= 100 ? "controlled" : "capturing";

  return {
    name: objectiveName(center),
    center,
    radius,
    controllerID: top.ownerID,
    controllerTeam: top.team,
    leaderID: top.ownerID,
    leaderTeam: top.team,
    controlPercent,
    status,
    navalPower: power,
  };
}

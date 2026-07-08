import type {
  TradeRouteData,
  TradeRouteRelation,
  TradeRouteRiskLevel,
  UnitState,
} from "../../types";
import {
  UT_CARRIER,
  UT_NAVAL_MINE,
  UT_PORT,
  UT_SUBMARINE,
  UT_TRADE_SHIP,
  UT_WARSHIP,
} from "../../types";

export type { TradeRouteData, TradeRouteRelation, TradeRouteRiskLevel };

export type EstimateTradeRouteGold = (
  distanceTiles: number,
  ownerID: number,
) => number;

// Must match RelationMatrix.ts
const RELATION_FRIENDLY = 1;
const ROUTE_THREAT_RANGE = 20;
const ROUTE_THREAT_TYPES: ReadonlySet<string> = new Set([
  UT_WARSHIP,
  UT_SUBMARINE,
  UT_CARRIER,
  UT_NAVAL_MINE,
]);
const ROUTE_ESCORT_TYPES: ReadonlySet<string> = new Set([
  UT_WARSHIP,
  UT_SUBMARINE,
  UT_CARRIER,
]);

function routeRelation(
  ownerID: number,
  localPlayerID: number,
  friendlyOwners: ReadonlySet<number>,
): TradeRouteRelation {
  if (localPlayerID > 0 && ownerID === localPlayerID) {
    return "own";
  }
  if (localPlayerID > 0 && friendlyOwners.has(ownerID)) {
    return "friendly";
  }
  return "foreign";
}

function distanceTiles(from: number, to: number, mapWidth: number): number {
  const fromX = from % mapWidth;
  const fromY = (from - fromX) / mapWidth;
  const toX = to % mapWidth;
  const toY = (to - toX) / mapWidth;
  return Math.round(Math.hypot(toX - fromX, toY - fromY));
}

function coords(pos: number, mapWidth: number): { x: number; y: number } {
  const x = pos % mapWidth;
  return { x, y: (pos - x) / mapWidth };
}

function distanceToSegment(
  point: number,
  from: number,
  to: number,
  mapWidth: number,
): number {
  const p = coords(point, mapWidth);
  const a = coords(from, mapWidth);
  const b = coords(to, mapWidth);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isLocalCoalitionRoute(
  routeOwnerID: number,
  localPlayerID: number,
  friendlyOwners: ReadonlySet<number>,
): boolean {
  return (
    localPlayerID > 0 &&
    (routeOwnerID === localPlayerID || friendlyOwners.has(routeOwnerID))
  );
}

function isEscortOwner(
  ownerID: number,
  routeOwnerID: number,
  localPlayerID: number,
  friendlyOwners: ReadonlySet<number>,
): boolean {
  if (ownerID === routeOwnerID) {
    return true;
  }
  if (!isLocalCoalitionRoute(routeOwnerID, localPlayerID, friendlyOwners)) {
    return false;
  }
  return ownerID === localPlayerID || friendlyOwners.has(ownerID);
}

function isThreatOwner(
  ownerID: number,
  routeOwnerID: number,
  localPlayerID: number,
  friendlyOwners: ReadonlySet<number>,
): boolean {
  return !isEscortOwner(ownerID, routeOwnerID, localPlayerID, friendlyOwners);
}

function enemyThreatCount(
  navalUnits: readonly UnitState[],
  routeOwnerID: number,
  from: number,
  to: number,
  mapWidth: number,
  localPlayerID: number,
  friendlyOwners: ReadonlySet<number>,
): number {
  let threats = 0;
  for (const unit of navalUnits) {
    if (
      !ROUTE_THREAT_TYPES.has(unit.unitType) ||
      !isThreatOwner(unit.ownerID, routeOwnerID, localPlayerID, friendlyOwners)
    ) {
      continue;
    }
    if (distanceToSegment(unit.pos, from, to, mapWidth) <= ROUTE_THREAT_RANGE) {
      threats++;
    }
  }
  return threats;
}

function escortCount(
  navalUnits: readonly UnitState[],
  routeOwnerID: number,
  from: number,
  to: number,
  mapWidth: number,
  localPlayerID: number,
  friendlyOwners: ReadonlySet<number>,
): number {
  let escorts = 0;
  for (const unit of navalUnits) {
    if (
      !ROUTE_ESCORT_TYPES.has(unit.unitType) ||
      !isEscortOwner(unit.ownerID, routeOwnerID, localPlayerID, friendlyOwners)
    ) {
      continue;
    }
    if (distanceToSegment(unit.pos, from, to, mapWidth) <= ROUTE_THREAT_RANGE) {
      escorts++;
    }
  }
  return escorts;
}

function riskLevel(enemyThreats: number): TradeRouteRiskLevel {
  if (enemyThreats === 0) return "safe";
  if (enemyThreats < 3) return "contested";
  return "dangerous";
}

/**
 * Read the local player's row of the relation matrix into the set of
 * friendly (ally / teammate) owner smallIDs consumed by deriveTradeRoutes.
 */
export function friendlyOwnersFromRelations(
  relationMatrix: Uint8Array,
  relationSize: number,
  localPlayerID: number,
): Set<number> {
  const friendly = new Set<number>();
  if (localPlayerID <= 0 || localPlayerID >= relationSize) return friendly;
  const row = localPlayerID * relationSize;
  for (let id = 1; id < relationSize; id++) {
    if (id !== localPlayerID && relationMatrix[row + id] === RELATION_FRIENDLY) {
      friendly.add(id);
    }
  }
  return friendly;
}

/**
 * Extract live trade route segments: one per active trade ship with a
 * destination port, classified by the owner's relation to the local player.
 * In replay / spectator mode (no local player) every route is "foreign".
 */
export function deriveTradeRoutes(
  units: ReadonlyMap<number, UnitState>,
  mapWidth: number,
  localPlayerID = 0,
  friendlyOwners: ReadonlySet<number> = new Set(),
  estimateGold?: EstimateTradeRouteGold,
): TradeRouteData[] {
  const routes: TradeRouteData[] = [];
  const navalUnits = Array.from(units.values()).filter(
    (unit) =>
      unit.isActive &&
      (ROUTE_THREAT_TYPES.has(unit.unitType) ||
        ROUTE_ESCORT_TYPES.has(unit.unitType)),
  );

  for (const unit of units.values()) {
    if (
      !unit.isActive ||
      unit.unitType !== UT_TRADE_SHIP ||
      unit.targetUnitId === null
    ) {
      continue;
    }

    const target = units.get(unit.targetUnitId);
    if (
      target === undefined ||
      !target.isActive ||
      target.unitType !== UT_PORT
    ) {
      continue;
    }

    const enemyThreats = enemyThreatCount(
      navalUnits,
      unit.ownerID,
      unit.pos,
      target.pos,
      mapWidth,
      localPlayerID,
      friendlyOwners,
    );

    const routeDistanceTiles = distanceTiles(unit.pos, target.pos, mapWidth);

    const route: TradeRouteData = {
      shipId: unit.id,
      ownerID: unit.ownerID,
      from: unit.pos,
      to: target.pos,
      distanceTiles: routeDistanceTiles,
      enemyThreats,
      escortCount: escortCount(
        navalUnits,
        unit.ownerID,
        unit.pos,
        target.pos,
        mapWidth,
        localPlayerID,
        friendlyOwners,
      ),
      relation: routeRelation(unit.ownerID, localPlayerID, friendlyOwners),
      riskLevel: riskLevel(enemyThreats),
    };
    if (estimateGold !== undefined) {
      // Arrival gold depends on tiles actually traveled: odometer so far
      // plus the remaining straight-line distance to the destination port.
      route.estimatedGold = estimateGold(
        (unit.tilesTraveled ?? 0) + routeDistanceTiles,
        unit.ownerID,
      );
    }
    routes.push(route);
  }

  return routes;
}

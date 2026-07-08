import { describe, expect, it } from "vitest";
import { deriveTradeRoutes } from "../../../../../src/client/render/frame/derive/TradeRoutes";
import type { UnitState } from "../../../../../src/client/render/types";
import {
  UT_CARRIER,
  UT_NAVAL_MINE,
  UT_PORT,
  UT_SUBMARINE,
  UT_TRADE_SHIP,
  UT_WARSHIP,
} from "../../../../../src/client/render/types";

const MAP_W = 100;

function unit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 1,
    unitType: UT_TRADE_SHIP,
    ownerID: 1,
    lastOwnerID: null,
    pos: 0,
    lastPos: 0,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: true,
    markedForDeletion: false,
    health: null,
    underConstruction: false,
    targetUnitId: null,
    targetTile: null,
    troops: 0,
    missileTimerQueue: [],
    level: 1,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    constructionStartTick: null,
    ...overrides,
  };
}

function units(...us: UnitState[]): Map<number, UnitState> {
  return new Map(us.map((u) => [u.id, u]));
}

describe("deriveTradeRoutes", () => {
  it("derives active trade routes with ship, owner, endpoints, and distance", () => {
    const [route] = deriveTradeRoutes(
      units(
        unit({ id: 1, ownerID: 7, pos: 205, targetUnitId: 2 }),
        unit({ id: 2, unitType: UT_PORT, pos: 830 }),
      ),
      MAP_W,
    );

    expect(route).toEqual({
      shipId: 1,
      ownerID: 7,
      from: 205,
      to: 830,
      distanceTiles: 26,
      enemyThreats: 0,
      escortCount: 0,
      relation: "foreign",
      riskLevel: "safe",
    });
  });

  it("classifies own, friendly, and foreign trade routes", () => {
    const routeUnits = units(
      unit({ id: 1, ownerID: 1, targetUnitId: 10 }),
      unit({ id: 2, ownerID: 3, targetUnitId: 10 }),
      unit({ id: 3, ownerID: 4, targetUnitId: 10 }),
      unit({ id: 10, unitType: UT_PORT, pos: 5 }),
    );

    expect(
      deriveTradeRoutes(routeUnits, MAP_W, 1, new Set([3])).map(
        (route) => route.relation,
      ),
    ).toEqual(["own", "friendly", "foreign"]);
  });

  it("skips inactive, untargeted, non-trade, and non-port routes", () => {
    const result = deriveTradeRoutes(
      units(
        unit({ id: 1, isActive: false, targetUnitId: 10 }),
        unit({ id: 2, targetUnitId: null }),
        unit({ id: 3, unitType: UT_WARSHIP, targetUnitId: 10 }),
        unit({ id: 4, targetUnitId: 99 }),
        unit({ id: 10, unitType: UT_WARSHIP, pos: 50 }),
        unit({ id: 99, unitType: UT_PORT, isActive: false, pos: 60 }),
      ),
      MAP_W,
    );

    expect(result).toEqual([]);
  });

  it("marks routes near enemy naval threats as contested or dangerous", () => {
    const contested = deriveTradeRoutes(
      units(
        unit({ id: 1, ownerID: 1, pos: 200, targetUnitId: 10 }),
        unit({ id: 10, unitType: UT_PORT, ownerID: 1, pos: 260 }),
        unit({ id: 20, unitType: UT_WARSHIP, ownerID: 2, pos: 230 }),
      ),
      MAP_W,
    );

    expect(contested[0]).toMatchObject({
      enemyThreats: 1,
      riskLevel: "contested",
    });

    const dangerous = deriveTradeRoutes(
      units(
        unit({ id: 1, ownerID: 1, pos: 200, targetUnitId: 10 }),
        unit({ id: 10, unitType: UT_PORT, ownerID: 1, pos: 260 }),
        unit({ id: 20, unitType: UT_WARSHIP, ownerID: 2, pos: 230 }),
        unit({ id: 21, unitType: UT_SUBMARINE, ownerID: 2, pos: 231 }),
        unit({ id: 22, unitType: UT_CARRIER, ownerID: 2, pos: 232 }),
        unit({ id: 23, unitType: UT_NAVAL_MINE, ownerID: 2, pos: 233 }),
      ),
      MAP_W,
    );

    expect(dangerous[0]).toMatchObject({
      enemyThreats: 4,
      riskLevel: "dangerous",
    });
  });

  it("counts own and friendly naval escorts near trade routes", () => {
    const [route] = deriveTradeRoutes(
      units(
        unit({ id: 1, ownerID: 1, pos: 200, targetUnitId: 10 }),
        unit({ id: 10, unitType: UT_PORT, ownerID: 1, pos: 260 }),
        unit({ id: 20, unitType: UT_WARSHIP, ownerID: 1, pos: 230 }),
        unit({ id: 21, unitType: UT_CARRIER, ownerID: 3, pos: 231 }),
        unit({ id: 22, unitType: UT_SUBMARINE, ownerID: 3, pos: 232 }),
        unit({ id: 23, unitType: UT_WARSHIP, ownerID: 4, pos: 233 }),
      ),
      MAP_W,
      1,
      new Set([3]),
    );

    expect(route).toMatchObject({
      enemyThreats: 1,
      escortCount: 3,
      riskLevel: "contested",
    });
  });

  it("can attach an estimated gold value to each route", () => {
    const [route] = deriveTradeRoutes(
      units(
        unit({ id: 1, ownerID: 7, pos: 205, targetUnitId: 2 }),
        unit({ id: 2, unitType: UT_PORT, pos: 830 }),
      ),
      MAP_W,
      0,
      new Set(),
      (distanceTiles, ownerID) => distanceTiles * 1_000 + ownerID,
    );

    expect(route).toMatchObject({
      distanceTiles: 26,
      estimatedGold: 26_007,
    });
  });
});

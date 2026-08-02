import { describe, expect, it } from "vitest";
import {
  collectHiddenSubmarineIds,
  shouldRenderSubmarineForLocalPlayer,
} from "../../../../src/client/render/gl/passes/UnitPass";
import type { UnitState } from "../../../../src/client/render/types";
import {
  UT_AIRCRAFT,
  UT_PORT,
  UT_SUBMARINE,
  UT_TRADE_SHIP,
  UT_WARSHIP,
} from "../../../../src/client/render/types";

const MAP_W = 100;
const REVEAL_RANGE = 20;

function ref(x: number, y: number): number {
  return y * MAP_W + x;
}

function unit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 1,
    unitType: UT_SUBMARINE,
    ownerID: 2,
    lastOwnerID: null,
    pos: ref(50, 50),
    lastPos: ref(50, 50),
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: true,
    markedForDeletion: false,
    health: 500,
    underConstruction: false,
    targetUnitId: null,
    targetTile: null,
    tilesTraveled: null,
    portSpecialization: null,
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

function renderable(
  submarine: UnitState,
  contacts: UnitState[] = [],
  allies: Set<number> = new Set(),
  localPlayerID = 1,
): boolean {
  return shouldRenderSubmarineForLocalPlayer(
    submarine,
    contacts,
    MAP_W,
    localPlayerID,
    allies,
    REVEAL_RANGE,
  );
}

describe("shouldRenderSubmarineForLocalPlayer", () => {
  it("always renders own and allied submarines", () => {
    expect(renderable(unit({ ownerID: 1 }))).toBe(true);
    expect(renderable(unit({ ownerID: 3 }), [], new Set([3]))).toBe(true);
  });

  it("hides enemy submarines outside friendly naval reveal range", () => {
    const enemySub = unit({ ownerID: 2, pos: ref(50, 50) });
    const friendlyWarship = unit({
      id: 10,
      unitType: UT_WARSHIP,
      ownerID: 1,
      pos: ref(10, 10),
    });

    expect(renderable(enemySub, [friendlyWarship])).toBe(false);
  });

  it("reveals enemy submarines near friendly naval sensors", () => {
    const enemySub = unit({ ownerID: 2, pos: ref(50, 50) });
    const friendlyWarship = unit({
      id: 10,
      unitType: UT_WARSHIP,
      ownerID: 1,
      pos: ref(65, 50),
    });
    const alliedPort = unit({
      id: 11,
      unitType: UT_PORT,
      ownerID: 3,
      pos: ref(70, 50),
    });

    expect(renderable(enemySub, [friendlyWarship])).toBe(true);
    expect(renderable(enemySub, [alliedPort], new Set([3]))).toBe(true);
  });

  it("reveals enemy submarines under friendly aircraft strike runs", () => {
    // Carrier aircraft engage submarines from well beyond the naval reveal
    // range — the strike (and its health damage) must not land on an
    // invisible hull, so the inbound aircraft itself acts as a sensor.
    const enemySub = unit({ ownerID: 2, pos: ref(50, 50) });
    const friendlyAircraft = unit({
      id: 10,
      unitType: UT_AIRCRAFT,
      ownerID: 1,
      pos: ref(60, 50),
    });
    const enemyAircraft = unit({
      id: 11,
      unitType: UT_AIRCRAFT,
      ownerID: 2,
      pos: ref(60, 50),
    });

    expect(renderable(enemySub, [friendlyAircraft])).toBe(true);
    expect(renderable(enemySub, [enemyAircraft])).toBe(false);
  });

  it("does not let civilian trade ships reveal submarines", () => {
    const enemySub = unit({ ownerID: 2, pos: ref(50, 50) });
    const friendlyTradeShip = unit({
      id: 10,
      unitType: UT_TRADE_SHIP,
      ownerID: 1,
      pos: ref(51, 50),
    });

    expect(renderable(enemySub, [friendlyTradeShip])).toBe(false);
  });

  it("renders submarines when there is no local player context", () => {
    expect(renderable(unit({ ownerID: 2 }), [], new Set(), 0)).toBe(true);
  });
});

describe("collectHiddenSubmarineIds", () => {
  it("collects hidden enemy submarines so other passes can skip them", () => {
    const hiddenSub = unit({ id: 1, ownerID: 2, pos: ref(50, 50) });
    const revealedSub = unit({ id: 2, ownerID: 2, pos: ref(12, 10) });
    const ownSub = unit({ id: 3, ownerID: 1, pos: ref(90, 90) });
    const friendlyWarship = unit({
      id: 10,
      unitType: UT_WARSHIP,
      ownerID: 1,
      pos: ref(10, 10),
    });

    const units = new Map<number, UnitState>([
      [1, hiddenSub],
      [2, revealedSub],
      [3, ownSub],
      [10, friendlyWarship],
    ]);

    const hidden = collectHiddenSubmarineIds(
      units,
      new Map(),
      MAP_W,
      1,
      new Set(),
      REVEAL_RANGE,
    );

    expect(hidden.has(1)).toBe(true);
    expect(hidden.has(2)).toBe(false);
    expect(hidden.has(3)).toBe(false);
    expect(hidden.has(10)).toBe(false);
  });

  it("uses friendly structures as reveal contacts", () => {
    const enemySub = unit({ id: 1, ownerID: 2, pos: ref(50, 50) });
    const ownPort = unit({
      id: 20,
      unitType: UT_PORT,
      ownerID: 1,
      pos: ref(55, 50),
    });

    const hidden = collectHiddenSubmarineIds(
      new Map([[1, enemySub]]),
      new Map([[20, ownPort]]),
      MAP_W,
      1,
      new Set(),
      REVEAL_RANGE,
    );

    expect(hidden.has(1)).toBe(false);
  });

  it("hides nothing without local player context", () => {
    const enemySub = unit({ id: 1, ownerID: 2, pos: ref(50, 50) });
    const hidden = collectHiddenSubmarineIds(
      new Map([[1, enemySub]]),
      new Map(),
      MAP_W,
      0,
      new Set(),
      REVEAL_RANGE,
    );
    expect(hidden.size).toBe(0);
  });
});

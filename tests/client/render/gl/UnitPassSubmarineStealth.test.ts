import { describe, expect, it } from "vitest";
import { shouldRenderSubmarineForLocalPlayer } from "../../../../src/client/render/gl/passes/UnitPass";
import type { UnitState } from "../../../../src/client/render/types";
import {
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

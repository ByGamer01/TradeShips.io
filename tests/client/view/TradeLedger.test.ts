import { describe, expect, it } from "vitest";
import type { UnitState } from "../../../src/client/render/types";
import { TradeLedger } from "../../../src/client/view/TradeLedger";
import { UnitType } from "../../../src/core/game/Game";
import { makeUnitUpdate } from "../../util/viewStubs";

function ledger() {
  return new TradeLedger({
    localPlayerID: () => 1,
    estimateGold: (tiles, ownerID) => tiles * 100 + ownerID,
    portOwnerID: (unitId) => (unitId === 10 ? 1 : 2),
    portTile: (unitId) => (unitId === 10 ? 99 : null),
  });
}

function state(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 1,
    unitType: UnitType.TradeShip,
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

describe("TradeLedger", () => {
  it("records local trade arrivals with authoritative traveled distance", () => {
    const l = ledger();

    l.onUnitUpdate(
      makeUnitUpdate({
        unitType: UnitType.TradeShip,
        ownerID: 1,
        isActive: false,
        reachedTarget: true,
        tilesTraveled: 12,
        targetUnitId: 20,
      }),
      state({ ownerID: 1, isActive: true }),
    );

    expect(l.summary()).toMatchObject({
      arrivals: 1,
      goldFromMyShips: 1201,
      goldAtMyPorts: 0,
    });
  });

  it("attributes foreign arrivals to local receiving ports", () => {
    const l = ledger();

    l.onUnitUpdate(
      makeUnitUpdate({
        unitType: UnitType.TradeShip,
        ownerID: 2,
        isActive: false,
        reachedTarget: true,
        tilesTraveled: 8,
        targetUnitId: 10,
      }),
      state({ ownerID: 2, isActive: true }),
    );

    expect(l.summary()).toMatchObject({
      goldAtMyPorts: 802,
      portIncome: [{ unitId: 10, tile: 99, gold: 802, arrivals: 1 }],
    });
  });

  it("passes destination owner to gold estimator for allied route bonuses", () => {
    const estimates: Array<{
      tiles: number;
      ownerID: number;
      destinationOwnerID?: number | null;
    }> = [];
    const l = new TradeLedger({
      localPlayerID: () => 1,
      estimateGold: (tiles, ownerID, destinationOwnerID) => {
        estimates.push({ tiles, ownerID, destinationOwnerID });
        return destinationOwnerID === 2 ? 1500 : 1000;
      },
      portOwnerID: (unitId) => (unitId === 20 ? 2 : null),
      portTile: () => null,
    });

    l.onUnitUpdate(
      makeUnitUpdate({
        unitType: UnitType.TradeShip,
        ownerID: 1,
        isActive: false,
        reachedTarget: true,
        tilesTraveled: 12,
        targetUnitId: 20,
      }),
      state({ ownerID: 1, isActive: true }),
    );

    expect(estimates).toEqual([
      { tiles: 12, ownerID: 1, destinationOwnerID: 2 },
    ]);
    expect(l.summary().goldFromMyShips).toBe(1500);
  });

  it("separates captured losses from captures made by the local player", () => {
    const l = ledger();

    l.onUnitUpdate(
      makeUnitUpdate({ unitType: UnitType.TradeShip, ownerID: 2 }),
      state({ ownerID: 1, isActive: true }),
    );
    l.onUnitUpdate(
      makeUnitUpdate({ unitType: UnitType.TradeShip, ownerID: 1 }),
      state({ ownerID: 2, isActive: true }),
    );

    expect(l.summary()).toMatchObject({
      shipsCaptured: 1,
      capturesByMe: 1,
    });
  });

  it("counts pirated arrivals separately from regular own arrivals", () => {
    const l = ledger();

    l.onUnitUpdate(
      makeUnitUpdate({
        unitType: UnitType.TradeShip,
        ownerID: 1,
        lastOwnerID: 2,
        isActive: false,
        reachedTarget: true,
        tilesTraveled: 6,
        targetUnitId: 10,
      }),
      state({ ownerID: 1, isActive: true }),
    );

    expect(l.summary()).toMatchObject({
      arrivals: 0,
      piratedArrivals: 1,
      goldFromMyShips: 601,
      goldAtMyPorts: 0,
    });
  });

  it("records local trade ships lost before arrival", () => {
    const l = ledger();

    l.onUnitUpdate(
      makeUnitUpdate({
        unitType: UnitType.TradeShip,
        ownerID: 1,
        isActive: false,
        reachedTarget: false,
      }),
      state({ ownerID: 1, isActive: true }),
    );

    expect(l.summary().shipsLost).toBe(1);
  });
});

import { describe, expect, test } from "vitest";
import { healthProgressForUnit } from "../../../../src/client/render/gl/passes/BarPass";
import type { UnitState } from "../../../../src/client/render/types";
import { UnitType } from "../../../../src/core/game/Game";
import { stubConfig } from "../../../util/viewStubs";

function unit(overrides: Partial<UnitState>): UnitState {
  return {
    id: 1,
    unitType: UnitType.Warship,
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

describe("healthProgressForUnit", () => {
  test("uses each naval unit's own max health instead of warship max health", () => {
    const config = stubConfig({
      unitInfo: (type: UnitType) => {
        if (type === UnitType.Submarine) return { maxHealth: 500 };
        if (type === UnitType.AircraftCarrier) return { maxHealth: 1500 };
        return { maxHealth: 1000 };
      },
    } as any);

    expect(
      healthProgressForUnit(
        unit({ unitType: UnitType.Submarine, health: 500 }),
        config,
      ),
    ).toBeNull();
    expect(
      healthProgressForUnit(
        unit({ unitType: UnitType.Submarine, health: 250 }),
        config,
      ),
    ).toBe(0.5);
    expect(
      healthProgressForUnit(
        unit({ unitType: UnitType.AircraftCarrier, health: 750 }),
        config,
      ),
    ).toBe(0.5);
  });
});

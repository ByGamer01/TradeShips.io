import { describe, expect, it } from "vitest";
import {
  deriveMaritimeObjective,
  maritimeObjectiveFromUpdate,
  type MaritimeObjectiveData,
} from "../../../../../src/client/render/frame/derive/MaritimeObjective";
import type { UnitState } from "../../../../../src/client/render/types";
import {
  UT_CARRIER,
  UT_SUBMARINE,
  UT_TRADE_SHIP,
  UT_WARSHIP,
} from "../../../../../src/client/render/types";

const MAP_W = 100;
const MAP_H = 100;
const CENTER = 50 * MAP_W + 50;

function unit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 1,
    unitType: UT_WARSHIP,
    ownerID: 1,
    lastOwnerID: null,
    pos: CENTER,
    lastPos: CENTER,
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

function units(...us: UnitState[]): Map<number, UnitState> {
  return new Map(us.map((u) => [u.id, u]));
}

function derive(
  us: ReadonlyMap<number, UnitState>,
  previous?: MaritimeObjectiveData,
) {
  return deriveMaritimeObjective(us, {
    mapWidth: MAP_W,
    mapHeight: MAP_H,
    isWater: () => true,
    previous,
  });
}

describe("deriveMaritimeObjective", () => {
  it("creates a neutral central sea objective when no fleet is present", () => {
    const objective = derive(units());

    expect(objective).toMatchObject({
      center: CENTER,
      controllerID: 0,
      leaderID: 0,
      controlPercent: 0,
      status: "neutral",
    });
    expect(objective.radius).toBeGreaterThan(0);
  });

  it("captures progressively for the only naval power inside the zone", () => {
    const objective = derive(
      units(unit({ id: 1, ownerID: 7, unitType: UT_WARSHIP })),
    );

    expect(objective).toMatchObject({
      controllerID: 7,
      leaderID: 7,
      status: "capturing",
    });
    expect(objective.controlPercent).toBeGreaterThan(0);
  });

  it("uses stronger naval units as more capture power", () => {
    const tradeShip = derive(
      units(unit({ id: 1, ownerID: 1, unitType: UT_TRADE_SHIP })),
    );
    const carrier = derive(
      units(unit({ id: 2, ownerID: 1, unitType: UT_CARRIER })),
    );

    expect(carrier.controlPercent).toBeGreaterThan(tradeShip.controlPercent);
  });

  it("pauses capture when rival fleets have equal power in the zone", () => {
    const previous = derive(
      units(unit({ id: 1, ownerID: 1, unitType: UT_WARSHIP })),
    );
    const objective = derive(
      units(
        unit({ id: 1, ownerID: 1, unitType: UT_WARSHIP }),
        unit({ id: 2, ownerID: 2, unitType: UT_SUBMARINE }),
      ),
      previous,
    );

    expect(objective.status).toBe("contested");
    expect(objective.controlPercent).toBe(previous.controlPercent);
  });

  it("aggregates control by team when team ownership is provided", () => {
    const objective = deriveMaritimeObjective(
      units(
        unit({ id: 1, ownerID: 1, unitType: UT_WARSHIP }),
        unit({ id: 2, ownerID: 2, unitType: UT_SUBMARINE }),
      ),
      {
        mapWidth: MAP_W,
        mapHeight: MAP_H,
        isWater: () => true,
        teamForOwner: (ownerID) =>
          ownerID === 1 || ownerID === 2 ? "Blue" : null,
      },
    );

    expect(objective).toMatchObject({
      controllerID: 1,
      controllerTeam: "Blue",
      leaderTeam: "Blue",
      status: "capturing",
      navalPower: [{ ownerID: 1, team: "Blue", power: 6 }],
    });
  });

  it("marks the objective controlled at 100 percent", () => {
    const previous = derive(
      units(unit({ id: 1, ownerID: 1, unitType: UT_CARRIER })),
    );
    const objective = derive(
      units(unit({ id: 1, ownerID: 1, unitType: UT_CARRIER })),
      { ...previous, controlPercent: 99.9, controllerID: 1, leaderID: 1 },
    );

    expect(objective).toMatchObject({
      controllerID: 1,
      leaderID: 1,
      controlPercent: 100,
      status: "controlled",
    });
  });
});

describe("maritimeObjectiveFromUpdate", () => {
  it("maps an authoritative core update to renderer objective data", () => {
    const objective = maritimeObjectiveFromUpdate({
      center: CENTER,
      radius: 20,
      controllerSmallID: 7,
      controllerTeam: null,
      leaderSmallID: 7,
      leaderTeam: null,
      controlPercent: 42.5,
      status: "capturing",
      navalPower: [{ smallID: 7, team: null, power: 6 }],
    });

    expect(objective).toMatchObject({
      center: CENTER,
      radius: 20,
      controllerID: 7,
      controllerTeam: null,
      leaderID: 7,
      leaderTeam: null,
      controlPercent: 42.5,
      status: "capturing",
      navalPower: [{ ownerID: 7, team: null, power: 6 }],
    });
    expect(objective.name.length).toBeGreaterThan(0);
  });

  it("keeps a stable objective name for the same center", () => {
    const base = {
      center: CENTER,
      radius: 20,
      controllerSmallID: 0,
      controllerTeam: "Red",
      leaderSmallID: 0,
      leaderTeam: "Red",
      controlPercent: 10,
      status: "capturing" as const,
      navalPower: [{ smallID: 0, team: "Red", power: 3 }],
    };

    const first = maritimeObjectiveFromUpdate(base);
    const second = maritimeObjectiveFromUpdate({ ...base, controlPercent: 55 });

    expect(first.name).toBe(second.name);
    expect(second.controllerTeam).toBe("Red");
    expect(second.controlPercent).toBe(55);
  });
});

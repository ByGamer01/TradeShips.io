import fs from "fs";
import path from "path";
import { buildTable } from "../../../src/client/hud/layers/BuildMenu";
import {
  ALL_UNIT_TYPES,
  UT_AIRCRAFT,
  UT_CARRIER,
  UT_CONGRESS,
  UT_NAVAL_MINE,
  UT_SUBMARINE,
  UT_TORPEDO,
} from "../../../src/client/render/types/UnitType";
import { UnitType } from "../../../src/core/game/Game";

const ROOT = path.join(__dirname, "..", "..", "..");

describe("renderer unit type registry", () => {
  test("registers torpedo as a renderable unit type", () => {
    expect(UT_TORPEDO).toBe("Torpedo");
    expect(ALL_UNIT_TYPES).toContain(UT_TORPEDO);
  });

  test("registers naval mine as a visible renderable unit type", () => {
    expect(UT_NAVAL_MINE).toBe("Naval Mine");
    expect(ALL_UNIT_TYPES).toContain(UT_NAVAL_MINE);
  });

  test("registers submarine, aircraft carrier, and aircraft render types", () => {
    expect(UT_SUBMARINE).toBe("Submarine");
    expect(UT_CARRIER).toBe("Aircraft Carrier");
    expect(UT_AIRCRAFT).toBe("Aircraft");
    expect(ALL_UNIT_TYPES).toEqual(
      expect.arrayContaining([UT_SUBMARINE, UT_CARRIER, UT_AIRCRAFT]),
    );
  });

  test("registers anti-air frigate as a visible naval render type", () => {
    expect(ALL_UNIT_TYPES).toContain("Anti-Air Frigate");
  });

  test("registers Congress as a visible structure render type", () => {
    expect(UT_CONGRESS).toBe("Congress");
    expect(ALL_UNIT_TYPES).toContain(UT_CONGRESS);
  });

  test("exposes naval units in the build menu display table", () => {
    const items = buildTable.flat();
    expect(items).toContainEqual(
      expect.objectContaining({
        unitType: UnitType.Submarine,
        icon: "/images/SubmarineIconWhite.svg",
        description: "build_menu.desc.submarine",
        key: "unit_type.submarine",
      }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        unitType: UnitType.AircraftCarrier,
        icon: "/images/AircraftCarrierIconWhite.svg",
        description: "build_menu.desc.aircraft_carrier",
        key: "unit_type.aircraft_carrier",
      }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        unitType: UnitType.NavalMine,
        icon: "/images/NavalMineIconWhite.svg",
        description: "build_menu.desc.naval_mine",
        key: "unit_type.naval_mine",
      }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        unitType: (UnitType as any).AntiAirFrigate,
        icon: "/images/AntiAirFrigateIconWhite.svg",
        description: "build_menu.desc.anti_air_frigate",
        key: "unit_type.anti_air_frigate",
      }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        unitType: UnitType.Congress,
        icon: "/images/CongressIconWhite.svg",
        description: "build_menu.desc.congress",
        key: "unit_type.congress",
      }),
    );
  });

  test("exposes a torpedo i18n label", () => {
    const en = JSON.parse(
      fs.readFileSync(path.join(ROOT, "resources", "lang", "en.json"), "utf8"),
    ) as {
      build_menu: {
        desc: {
          aircraft_carrier?: string;
          naval_mine?: string;
          anti_air_frigate?: string;
          congress?: string;
          submarine?: string;
        };
      };
      unit_type: {
        aircraft?: string;
        aircraft_carrier?: string;
        anti_air_frigate?: string;
        congress?: string;
        naval_mine?: string;
        submarine?: string;
        torpedo?: string;
      };
      user_setting: {
        build_aircraft_carrier?: string;
        build_aircraft_carrier_desc?: string;
        build_congress?: string;
        build_congress_desc?: string;
        build_naval_mine?: string;
        build_naval_mine_desc?: string;
        build_submarine?: string;
        build_submarine_desc?: string;
      };
    };

    expect(en.build_menu.desc.submarine).toBe("Stealth torpedo raider");
    expect(en.build_menu.desc.aircraft_carrier).toBe(
      "Long-range aircraft strike platform",
    );
    expect(en.build_menu.desc.naval_mine).toBe("Single-use naval explosive");
    expect(en.build_menu.desc.anti_air_frigate).toBe(
      "Escorts fleets with short-range anti-air",
    );
    expect(en.build_menu.desc.congress).toBe(
      "Unlocks tariffs against enemy trade",
    );
    expect(en.unit_type.submarine).toBe("Submarine");
    expect(en.unit_type.aircraft_carrier).toBe("Aircraft Carrier");
    expect(en.unit_type.anti_air_frigate).toBe("Anti-Air Frigate");
    expect(en.unit_type.congress).toBe("Congress");
    expect(en.unit_type.aircraft).toBe("Aircraft");
    expect(en.unit_type.naval_mine).toBe("Naval Mine");
    expect(en.unit_type.torpedo).toBe("Torpedo");
    expect(en.user_setting.build_submarine).toBe("Build Submarine");
    expect(en.user_setting.build_submarine_desc).toBe(
      "Build a Submarine under your cursor.",
    );
    expect(en.user_setting.build_aircraft_carrier).toBe(
      "Build Aircraft Carrier",
    );
    expect(en.user_setting.build_aircraft_carrier_desc).toBe(
      "Build an Aircraft Carrier under your cursor.",
    );
    expect(en.user_setting.build_congress).toBe("Build Congress");
    expect(en.user_setting.build_congress_desc).toBe(
      "Build a Congress under your cursor.",
    );
    expect(en.user_setting.build_naval_mine).toBe("Build Naval Mine");
    expect(en.user_setting.build_naval_mine_desc).toBe(
      "Build a Naval Mine under your cursor.",
    );
  });
});

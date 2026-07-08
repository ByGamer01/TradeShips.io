import { describe, expect, it } from "vitest";
import {
  UNIT_TYPE_TRANSLATION_KEYS,
  unitOptions,
} from "../../src/client/UnitTypeLabels";
import { UnitType } from "../../src/core/game/Game";

describe("UnitTypeLabels", () => {
  it("keeps host-disable options and disabled-unit labels in one shared map", () => {
    for (const option of unitOptions) {
      expect(UNIT_TYPE_TRANSLATION_KEYS[option.type]).toBe(
        option.translationKey,
      );
    }

    expect(UNIT_TYPE_TRANSLATION_KEYS[UnitType.NavalMine]).toBe(
      "unit_type.naval_mine",
    );
    expect(UNIT_TYPE_TRANSLATION_KEYS[UnitType.Submarine]).toBe(
      "unit_type.submarine",
    );
    expect(UNIT_TYPE_TRANSLATION_KEYS[UnitType.AircraftCarrier]).toBe(
      "unit_type.aircraft_carrier",
    );
  });
});

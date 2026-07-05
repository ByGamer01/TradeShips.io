import { DISABLED_ARSENAL, UnitType } from "../../src/core/game/Game";
import { GameConfig } from "../../src/core/Schemas";
import { enforceArsenalLock } from "../../src/server/ArsenalLock";

describe("enforceArsenalLock", () => {
  test("forces the full arsenal disabled and clears waterNukes, even when a manipulated config sends the opposite", () => {
    const input = { disabledUnits: [], waterNukes: true } as GameConfig;

    const output = enforceArsenalLock(input);

    for (const unit of DISABLED_ARSENAL) {
      expect(output.disabledUnits).toContain(unit);
    }
    expect(output.waterNukes).toBeFalsy();
  });

  test("preserves extra non-arsenal disabledUnits entries (union, not replace)", () => {
    const input = {
      disabledUnits: [UnitType.Port],
    } as GameConfig;

    const output = enforceArsenalLock(input);

    expect(output.disabledUnits).toContain(UnitType.Port);
    for (const unit of DISABLED_ARSENAL) {
      expect(output.disabledUnits).toContain(unit);
    }
  });

  test("does not mutate the input config", () => {
    const input = {
      disabledUnits: [UnitType.Port],
      waterNukes: true,
    } as GameConfig;
    const inputDisabledUnitsRef = input.disabledUnits;

    enforceArsenalLock(input);

    expect(input.disabledUnits).toBe(inputDisabledUnitsRef);
    expect(input.disabledUnits).toEqual([UnitType.Port]);
    expect(input.waterNukes).toBe(true);
  });
});

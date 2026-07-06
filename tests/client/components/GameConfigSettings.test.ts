import { describe, expect, it } from "vitest";
import {
  GameConfigSettings,
  unitOptions,
} from "../../../src/client/components/GameConfigSettings";
import { UnitType } from "../../../src/core/game/Game";

describe("GameConfigSettings arsenal pruning (REQ-7)", () => {
  it("only renders toggles for the 5 non-arsenal unit types", () => {
    const el = new GameConfigSettings();

    const options = (el as any).renderUnitTypeOptions([]);

    expect(options).toHaveLength(5);
  });

  it("exposes exactly the naval-economic unit set, in identity not just count", () => {
    expect(new Set(unitOptions.map((o) => o.type))).toEqual(
      new Set([
        UnitType.City,
        UnitType.Port,
        UnitType.Warship,
        UnitType.TransportShip,
        UnitType.Factory,
      ]),
    );
  });
});

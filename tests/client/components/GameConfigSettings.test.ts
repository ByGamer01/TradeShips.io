import { describe, expect, it } from "vitest";
import { GameConfigSettings } from "../../../src/client/components/GameConfigSettings";

describe("GameConfigSettings arsenal pruning (REQ-7)", () => {
  it("only renders toggles for the 5 non-arsenal unit types", () => {
    const el = new GameConfigSettings();

    const options = (el as any).renderUnitTypeOptions([]);

    expect(options).toHaveLength(5);
  });
});

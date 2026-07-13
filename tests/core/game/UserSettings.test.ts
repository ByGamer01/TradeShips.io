import { describe, expect, it } from "vitest";
import { getDefaultKeybinds } from "../../../src/core/game/UserSettings";

describe("default build keybinds", () => {
  it("keeps structures on 1-4 and naval vehicles on 5-9", () => {
    const keybinds = getDefaultKeybinds(false);

    expect(keybinds.buildCity).toBe("Digit1");
    expect(keybinds.buildFactory).toBe("Digit2");
    expect(keybinds.buildPort).toBe("Digit3");
    expect(keybinds.buildCongress).toBe("Digit4");
    expect(keybinds.buildSubmarine).toBe("Digit5");
    expect(keybinds.buildAircraftCarrier).toBe("Digit6");
    expect(keybinds.buildWarship).toBe("Digit7");
    expect(keybinds.buildAntiAirFrigate).toBe("Digit8");
    expect(keybinds.buildNavalMine).toBe("Digit9");
  });
});

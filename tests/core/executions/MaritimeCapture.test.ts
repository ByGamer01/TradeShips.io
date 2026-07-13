import { describe, expect, it } from "vitest";
import {
  CAPTURE_POWER_CAP,
  CAPTURE_RATE_PER_POWER_PER_TICK,
  CaptureState,
  NavalPowerEntry,
  newCaptureState,
  stepCapture,
} from "../../../src/core/execution/utils/MaritimeCapture";

function entry(id: string, power: number): NavalPowerEntry {
  return { controller: id, power };
}

function step(state: CaptureState, ...entries: NavalPowerEntry[]): void {
  stepCapture(
    state,
    [...entries].sort(
      (a, b) => b.power - a.power || String(a.controller).localeCompare(String(b.controller)),
    ),
  );
}

describe("stepCapture", () => {
  it("advances capture by the power advantage over the runner-up, not absolute power", () => {
    const contested = newCaptureState();
    step(contested, entry("red", 9), entry("blue", 6));

    const alone = newCaptureState();
    step(alone, entry("red", 3));

    // Advantage is 3 in both cases: a weaker rival fleet cancels out
    // an equal share of the leader's power.
    expect(contested.controlPercent).toBeCloseTo(alone.controlPercent);
    expect(contested.controlPercent).toBeCloseTo(
      3 * CAPTURE_RATE_PER_POWER_PER_TICK,
    );
    expect(contested.status).toBe("capturing");
    expect(contested.leader).toBe("red");
  });

  it("caps the capture rate so spamming ships beyond the cap adds nothing", () => {
    const spam = newCaptureState();
    step(spam, entry("red", CAPTURE_POWER_CAP * 10));

    const atCap = newCaptureState();
    step(atCap, entry("red", CAPTURE_POWER_CAP));

    expect(spam.controlPercent).toBeCloseTo(atCap.controlPercent);
    expect(spam.controlPercent).toBeCloseTo(
      CAPTURE_POWER_CAP * CAPTURE_RATE_PER_POWER_PER_TICK,
    );
  });

  it("drains an existing holder by the rival's advantage before flipping control", () => {
    const state = newCaptureState();
    step(state, entry("red", CAPTURE_POWER_CAP));
    expect(state.controller).toBe("red");
    const held = state.controlPercent;

    step(state, entry("blue", 6), entry("red", 3));
    expect(state.controller).toBe("red");
    expect(state.leader).toBe("blue");
    expect(state.controlPercent).toBeCloseTo(
      held - 3 * CAPTURE_RATE_PER_POWER_PER_TICK,
    );
  });

  it("freezes progress as contested when the top fleets tie", () => {
    const state = newCaptureState();
    step(state, entry("red", 3), entry("blue", 3));

    expect(state.status).toBe("contested");
    expect(state.leader).toBeNull();
    expect(state.controlPercent).toBe(0);
  });

  it("keeps decaying nothing when the zone is empty", () => {
    const state = newCaptureState();
    step(state, entry("red", 3));
    const progress = state.controlPercent;

    stepCapture(state, []);
    expect(state.controlPercent).toBe(progress);
    expect(state.status).toBe("capturing");
    expect(state.leader).toBeNull();
  });
});

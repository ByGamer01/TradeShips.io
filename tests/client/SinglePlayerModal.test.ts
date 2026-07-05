import { describe, expect, it } from "vitest";
import { DISABLED_ARSENAL } from "../../src/core/game/Game";
import { SinglePlayerModal } from "../../src/client/SinglePlayerModal";

describe("SinglePlayerModal arsenal lock defaults", () => {
  it("defaults disabledUnits to the full arsenal", () => {
    const modal = new SinglePlayerModal();

    expect((modal as any).disabledUnits).toEqual(DISABLED_ARSENAL);
  });

  it("does not flag the fresh default as a custom setting", () => {
    const modal = new SinglePlayerModal();

    expect((modal as any).hasOptionsChanged()).toBe(false);
  });
});

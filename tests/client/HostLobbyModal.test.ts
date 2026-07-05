import { describe, expect, it } from "vitest";
import { DISABLED_ARSENAL } from "../../src/core/game/Game";
import { HostLobbyModal } from "../../src/client/HostLobbyModal";

describe("HostLobbyModal arsenal lock defaults", () => {
  it("defaults disabledUnits to the full arsenal", () => {
    const modal = new HostLobbyModal();

    expect((modal as any).disabledUnits).toEqual(DISABLED_ARSENAL);
  });
});

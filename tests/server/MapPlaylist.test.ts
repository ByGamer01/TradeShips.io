import { DISABLED_ARSENAL, UnitType } from "../../src/core/game/Game";
import { MapPlaylist } from "../../src/server/MapPlaylist";

function expectSupersetOfArsenal(disabledUnits: unknown[] | undefined) {
  expect(disabledUnits).toBeDefined();
  for (const unit of DISABLED_ARSENAL) {
    expect(disabledUnits).toContain(unit);
  }
}

describe("MapPlaylist arsenal lock defaults", () => {
  test("public FFA games disable the full arsenal", async () => {
    const playlist = new MapPlaylist();
    const config = await playlist.gameConfig("ffa");
    expectSupersetOfArsenal(config.disabledUnits);
  });

  test("public Team games disable the full arsenal", async () => {
    const playlist = new MapPlaylist();
    const config = await playlist.gameConfig("team");
    expectSupersetOfArsenal(config.disabledUnits);
  });

  test("public 1v1 games disable the full arsenal", () => {
    const playlist = new MapPlaylist();
    const config = playlist.get1v1Config();
    expectSupersetOfArsenal(config.disabledUnits);
  });
});

describe("MapPlaylist special mode never reintroduces the arsenal", () => {
  const SPECIAL_DRAWS = 180;

  test("every special draw keeps the full arsenal (incl. DefensePost) disabled, never forces waterNukes, and never exposes the retired modifier flags", async () => {
    const playlist = new MapPlaylist();

    for (let i = 0; i < SPECIAL_DRAWS; i++) {
      const config = await playlist.gameConfig("special");

      // (a) arsenal always disabled, including DefensePost unconditionally (REQ-4).
      expectSupersetOfArsenal(config.disabledUnits);
      expect(config.disabledUnits).toContain(UnitType.DefensePost);

      // (b) special mode never forces an arsenal-incompatible waterNukes flag (REQ-5).
      expect(config.waterNukes).not.toBe(true);

      // (c) retired modifier flags must never surface as truthy (ADR-2).
      expect(config.publicGameModifiers?.isNukesDisabled).toBeFalsy();
      expect(config.publicGameModifiers?.isSAMsDisabled).toBeFalsy();
      expect(config.publicGameModifiers?.isWaterNukes).toBeFalsy();

      // (d) construction-time invariant (REQ-6): no modifier flag may imply a
      // disabled unit absent from disabledUnits, and no flag may contradict a
      // disabledUnits entry.
      const disabled = new Set(config.disabledUnits ?? []);
      if (config.publicGameModifiers?.isPortsDisabled) {
        expect(disabled.has(UnitType.Port)).toBe(true);
      }
    }
  });
});

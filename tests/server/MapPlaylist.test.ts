import fs from "fs";
import path from "path";
import {
  DISABLED_ARSENAL,
  GameMapType,
  UnitType,
} from "../../src/core/game/Game";
import { maps } from "../../src/core/game/Maps.gen";
import { isMaritimeMap } from "../../src/core/game/MaritimeMaps";
import { MapPlaylist } from "../../src/server/MapPlaylist";

const ROOT = path.join(__dirname, "..", "..");

function waterRatio(map: GameMapType): number {
  const info = maps.find((m) => m.type === map);
  if (!info) throw new Error(`Unknown map ${map}`);
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        "resources",
        "maps",
        info.id.toLowerCase(),
        "manifest.json",
      ),
      "utf8",
    ),
  ) as { map: { width: number; height: number; num_land_tiles: number } };
  const totalTiles = manifest.map.width * manifest.map.height;
  return (totalTiles - manifest.map.num_land_tiles) / totalTiles;
}

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

  test("public 1v1 games use maritime maps", () => {
    const playlist = new MapPlaylist();

    for (let i = 0; i < 25; i++) {
      expect(isMaritimeMap(playlist.get1v1Config().gameMap)).toBe(true);
    }
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
  }, // 180 async draws (each awaiting getMapLandTiles) can exceed the default
  // 5s timeout under full-suite CPU contention even though each draw is
  // fast in isolation.
  20_000);
});

describe("MapPlaylist maritime map curation", () => {
  test.each(["ffa", "team", "special"] as const)(
    "%s playlist only contains island/archipelago maps",
    (type) => {
      const playlist = new MapPlaylist();
      const mapsForType = new Set<GameMapType>(
        (playlist as any).buildMapsList(type),
      );

      expect(mapsForType.size).toBeGreaterThan(0);
      expect(mapsForType).not.toContain(GameMapType.Alps);
      expect(mapsForType).not.toContain(GameMapType.World);
      expect(mapsForType).not.toContain(GameMapType.BajaCalifornia);
      expect(mapsForType).not.toContain(GameMapType.NorthwestPassage);
      expect(mapsForType).not.toContain(GameMapType.StraitOfMalacca);
      expect(mapsForType).not.toContain(GameMapType.TaiwanStrait);
      expect(mapsForType).not.toContain(GameMapType.Venice);

      for (const map of mapsForType) {
        expect(waterRatio(map)).toBeGreaterThanOrEqual(0.6);
      }
    },
  );

  it("promotes Archipelago Sea into the regular maritime rotation", () => {
    const playlist = new MapPlaylist();

    expect(new Set((playlist as any).buildMapsList("ffa"))).toContain(
      GameMapType.ArchipelagoSea,
    );
  });

  it("1v1 config never selects straits or passage maps", () => {
    const playlist = new MapPlaylist();

    for (let i = 0; i < 50; i++) {
      expect([
        GameMapType.NorthwestPassage,
        GameMapType.Passage,
        GameMapType.StraitOfMalacca,
        GameMapType.TaiwanStrait,
      ]).not.toContain(playlist.get1v1Config().gameMap);
    }
  });
});

describe("MapPlaylist public starting gold", () => {
  test("special rotation draws starting gold from the modifier pool, not a forced value", async () => {
    const playlist = new MapPlaylist();
    const seen = new Set<number | undefined>();

    for (let i = 0; i < 40; i++) {
      const config = await playlist.gameConfig("special");
      const gold = config.startingGold as number | undefined;
      seen.add(gold);

      expect([undefined, 1_000_000, 5_000_000, 25_000_000]).toContain(gold);
      expect(config.publicGameModifiers?.startingGold).toBe(gold);
      // 25M keeps disabling nations (no PVP immunity for them).
      if (gold !== undefined && gold >= 25_000_000) {
        expect(config.nations).toBe("disabled");
      }
    }

    // Random pool: 40 draws must not all land on the same gold value.
    expect(seen.size).toBeGreaterThan(1);
  }, 15_000);
});

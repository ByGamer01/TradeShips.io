import { DISABLED_ARSENAL } from "../../src/core/game/Game";
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

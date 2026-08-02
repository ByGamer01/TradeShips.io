// Visual probe: do Submarine / Carrier (and thus the shared naval sprite
// path) actually render on the live WebGL map? Builds a port + submarine +
// carrier for the local player via real BuildUnitIntentEvents, zooms in,
// and screenshots.
import fs from "fs";
import {
  gotoHome,
  launch,
  openSoloModal,
} from "./.claude/skills/run-openfront/driver.mjs";
import {
  gameState,
  spawn,
  startSoloGame,
  waitForSpawnPhaseEnd,
  waitForTick,
} from "./.claude/skills/run-openfront/game.mjs";

const OUT = "C:/Users/david/AppData/Local/Temp/claude/C--Users-david-tradeships-io/d922a2fe-c606-4004-9ff1-21f91bb2dfd0/scratchpad/probe";
fs.mkdirSync(OUT, { recursive: true });

const { browser, page } = await launch({ rafIntervalMs: 1500 });
try {
  await gotoHome(page);
  await openSoloModal(page);
  await startSoloGame(page, {
    bots: 0,
    instantBuild: true,
    infiniteGold: true,
    infiniteTroops: true,
  });
  console.log("game ready:", JSON.stringify(await gameState(page)));

  // Spawn on a coastal tile: land, unowned, with an ocean-water 4-neighbor.
  const coastSpawn = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const W = g.width(), H = g.height();
    for (let y = 20; y < H - 20; y += 2) {
      for (let x = 20; x < W - 20; x += 2) {
        const r = g.ref(x, y);
        if (!g.isLand(r) || g.hasOwner(r)) continue;
        const nbrs = [g.ref(x + 1, y), g.ref(x - 1, y), g.ref(x, y + 1), g.ref(x, y - 1)];
        if (nbrs.some((n) => !g.isLand(n))) return { x, y };
      }
    }
    return null;
  });
  if (!coastSpawn) throw new Error("no coastal spawn tile found");
  console.log("coast spawn:", coastSpawn);
  await spawn(page, coastSpawn);
  await waitForSpawnPhaseEnd(page);

  // Find MY coastal tile + its adjacent water.
  const site = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const me = g.myPlayer();
    const W = g.width(), H = g.height();
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const r = g.ref(x, y);
        if (!g.isLand(r) || g.owner(r) !== me) continue;
        const nbrs = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
        ];
        for (const [nx, ny] of nbrs) {
          const n = g.ref(nx, ny);
          if (!g.isLand(n)) return { land: { x, y }, water: { x: nx, y: ny } };
        }
      }
    }
    return null;
  });
  if (!site) throw new Error("no owned coast tile");
  console.log("site:", JSON.stringify(site));

  // Emit real build intents through the client event bus.
  const emitBuild = (unitType, x, y) =>
    page.evaluate(
      ([ut, bx, by]) => {
        const bm = document.querySelector("build-menu");
        const bus = bm.eventBus;
        const ctor = [...bus.listeners.keys()].find(
          (c) => c.name === "BuildUnitIntentEvent",
        );
        if (!ctor) return "no ctor";
        const g = bm.game;
        bus.emit(new ctor(ut, g.ref(bx, by), false));
        return "ok";
      },
      [unitType, x, y],
    );

  const t0 = (await gameState(page)).ticks;
  console.log("build port:", await emitBuild("Port", site.land.x, site.land.y));
  await waitForTick(page, t0 + 10);
  console.log(
    "build sub:",
    await emitBuild("Submarine", site.water.x, site.water.y),
  );
  console.log(
    "build carrier:",
    await emitBuild("Aircraft Carrier", site.water.x, site.water.y),
  );
  await waitForTick(page, t0 + 30);

  // Ground truth: what units exist and where?
  const units = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const me = g.myPlayer();
    return me.units().map((u) => ({
      type: u.type(),
      x: g.x(u.tile()),
      y: g.y(u.tile()),
    }));
  });
  console.log("my units:", JSON.stringify(units));

  // Zoom the camera onto the water site and screenshot.
  await page.evaluate(
    ([x, y]) => {
      const t = document.querySelector("build-menu").transformHandler;
      t.clearTarget();
      t.scale = 14;
      t.offsetX = x;
      t.offsetY = y;
    },
    [site.water.x, site.water.y],
  );
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/naval-zoom.png` });
  console.log("screenshot:", `${OUT}/naval-zoom.png`);
} finally {
  await browser.close();
}

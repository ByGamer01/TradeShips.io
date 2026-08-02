// Probe 3: isolate whether the render gap is type-specific. Builds Warship +
// Submarine + Carrier, locks camera, logs each unit's exact screen px at
// screenshot time.
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

const { browser, page } = await launch({ rafIntervalMs: 1500 });
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log("NAVIGATED →", f.url());
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
});
try {
  await gotoHome(page);
  await openSoloModal(page);
  await startSoloGame(page, {
    bots: 0,
    instantBuild: true,
    infiniteGold: true,
    infiniteTroops: true,
  });

  const coastSpawn = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const W = g.width(), H = g.height();
    for (let y = 200; y < H - 200; y += 2) {
      for (let x = 200; x < W - 200; x += 2) {
        const r = g.ref(x, y);
        if (!g.isLand(r) || g.hasOwner(r)) continue;
        const nbrs = [g.ref(x + 1, y), g.ref(x - 1, y), g.ref(x, y + 1), g.ref(x, y - 1)];
        if (nbrs.some((n) => !g.isLand(n))) return { x, y };
      }
    }
    return null;
  });
  await spawn(page, coastSpawn);
  await waitForSpawnPhaseEnd(page);

  const site = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const me = g.myPlayer();
    const W = g.width(), H = g.height();
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const r = g.ref(x, y);
        if (!g.isLand(r) || g.owner(r) !== me) continue;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!g.isLand(g.ref(nx, ny))) return { land: { x, y }, water: { x: nx, y: ny } };
        }
      }
    }
    return null;
  });

  const emitBuild = (unitType, x, y) =>
    page.evaluate(
      ([ut, bx, by]) => {
        const bm = document.querySelector("build-menu");
        const bus = bm.eventBus;
        const ctor = [...bus.listeners.keys()].find(
          (c) => c.name === "BuildUnitIntentEvent",
        );
        const g = bm.game;
        bus.emit(new ctor(ut, g.ref(bx, by), false));
        return "ok";
      },
      [unitType, x, y],
    );

  const myTypes = () =>
    page.evaluate(() => {
      const g = document.querySelector("build-menu").game;
      return g.myPlayer().units().map((u) => u.type());
    });

  // Build with retries — intents occasionally get dropped while the sim warms up.
  const wanted = ["Port", "Warship", "Submarine", "Aircraft Carrier"];
  for (let attempt = 0; attempt < 12; attempt++) {
    const have = await myTypes();
    const missing = wanted.filter((w) => !have.includes(w));
    if (missing.length === 0) break;
    for (const m of missing) {
      if (m === "Port") await emitBuild("Port", site.land.x, site.land.y);
      else if (have.includes("Port"))
        await emitBuild(m, site.water.x, site.water.y);
    }
    await page.waitForTimeout(3000);
  }
  console.log("final units:", JSON.stringify(await myTypes()));

  // Camera on the fleet's centroid, then report screen px per unit.
  const info = await page.evaluate(() => {
    const bm = document.querySelector("build-menu");
    const g = bm.game;
    const t = bm.transformHandler;
    const me = g.myPlayer();
    const units = me.units().filter((u) =>
      ["Warship", "Submarine", "Aircraft Carrier", "Port"].includes(u.type()),
    );
    const cx = units.reduce((s, u) => s + g.x(u.tile()), 0) / units.length;
    const cy = units.reduce((s, u) => s + g.y(u.tile()), 0) / units.length;
    t.clearTarget();
    t.scale = 12;
    t.offsetX = cx;
    t.offsetY = cy;
    return { cx, cy };
  });
  console.log("camera:", JSON.stringify(info));
  await page.waitForTimeout(3500);
  // Re-lock the camera right before the shot — something (post-spawn goto,
  // clamping) keeps moving it during the wait.
  const at = await page.evaluate(() => {
    const bm = document.querySelector("build-menu");
    const g = bm.game;
    const t = bm.transformHandler;
    const me = g.myPlayer();
    const units = me.units();
    const sub = units.find((u) => u.type() === "Submarine") ?? units[0];
    t.clearTarget();
    t.scale = 12;
    // offsetX/Y are relative to the map center (see screenToWorldCoordinatesFloat).
    t.offsetX = g.x(sub.tile()) - g.width() / 2;
    t.offsetY = g.y(sub.tile()) - g.height() / 2;
    // Correct residual screen error (canvas rect vs map-size mismatch).
    for (let i = 0; i < 3; i++) {
      const s = t.worldToScreenCoordinates({ x: g.x(sub.tile()), y: g.y(sub.tile()) });
      t.offsetX += (s.x - window.innerWidth / 2) / t.scale;
      t.offsetY += (s.y - window.innerHeight / 2) / t.scale;
    }
    return units.map((u) => {
      const s = t.worldToScreenCoordinates({ x: g.x(u.tile()), y: g.y(u.tile()) });
      return { t: u.type(), wx: g.x(u.tile()), wy: g.y(u.tile()), sx: Math.round(s.x), sy: Math.round(s.y) };
    });
  });
  console.log("units@shot:", JSON.stringify(at));
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `${OUT}/fleet.png` });
  console.log("screenshot:", `${OUT}/fleet.png`);
} finally {
  await browser.close();
}

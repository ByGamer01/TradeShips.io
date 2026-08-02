// Follow-up probe: camera locked onto the live submarine position at high
// zoom, positions re-read at screenshot time. Also dumps renderer-side unit
// state to see whether the frame data even contains the naval units.
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

  const t0 = (await gameState(page)).ticks;
  await emitBuild("Port", site.land.x, site.land.y);
  await waitForTick(page, t0 + 10);
  await emitBuild("Submarine", site.water.x, site.water.y);
  await emitBuild("Aircraft Carrier", site.water.x, site.water.y);
  await waitForTick(page, t0 + 25);

  // Renderer-side: does the GameView's unit-state map hold them, and what
  // does the local-player/small-ID wiring look like?
  const rendererView = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const me = g.myPlayer();
    const states = [];
    // GameView.unitStates() — line ~1260 returns the map the GL frame uses.
    const map = g.unitStates ? g.unitStates() : null;
    if (map) {
      for (const [id, s] of map) {
        states.push({
          id,
          unitType: s.unitType,
          ownerID: s.ownerID,
          isActive: s.isActive,
          x: s.pos % g.width(),
          y: Math.floor(s.pos / g.width()),
        });
      }
    }
    return { mySmallID: me.smallID(), states };
  });
  console.log("renderer states:", JSON.stringify(rendererView, null, 1));

  // Lock camera on the sub NOW and screenshot immediately after 2 frames.
  const shot = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const me = g.myPlayer();
    const sub = me.units().find((u) => u.type() === "Submarine");
    const carrier = me.units().find((u) => u.type() === "Aircraft Carrier");
    const t = document.querySelector("build-menu").transformHandler;
    t.clearTarget();
    t.scale = 20;
    t.offsetX = g.x(sub.tile());
    t.offsetY = g.y(sub.tile());
    return {
      sub: { x: g.x(sub.tile()), y: g.y(sub.tile()) },
      carrier: { x: g.x(carrier.tile()), y: g.y(carrier.tile()) },
    };
  });
  console.log("camera on:", JSON.stringify(shot));
  await page.waitForTimeout(3500);
  const after = await page.evaluate(() => {
    const g = document.querySelector("build-menu").game;
    const me = g.myPlayer();
    return me.units().map((u) => ({ t: u.type(), x: g.x(u.tile()), y: g.y(u.tile()) }));
  });
  console.log("units at shot:", JSON.stringify(after));
  await page.screenshot({ path: `${OUT}/sub-zoom.png` });
  console.log("screenshot:", `${OUT}/sub-zoom.png`);
} finally {
  await browser.close();
}

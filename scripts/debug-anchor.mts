import fs from "fs";
import { genTerrainFromBin, MapManifest } from "../src/core/game/TerrainMapLoader";
import { findOpenWaterAnchor, findTradeLane } from "../src/core/game/TradeLaneFinder";

// Usage: npx tsx scripts/debug-anchor.mts [mapName]
const dir = `resources/maps/${process.argv[2] ?? "britannia"}`;
const manifest = JSON.parse(
  fs.readFileSync(`${dir}/manifest.json`, "utf8"),
) as MapManifest;
const map = await genTerrainFromBin(manifest.map, fs.readFileSync(`${dir}/map.bin`));
const mini = await genTerrainFromBin(manifest.map4x, fs.readFileSync(`${dir}/map4x.bin`));

console.log(`map ${map.width()}x${map.height()}`);
const anchor = findOpenWaterAnchor(map, mini);
if (anchor === null) {
  console.log("anchor: null");
} else {
  const x = anchor % map.width();
  const y = (anchor - x) / map.width();
  console.log(
    `anchor: (${x},${y}) of ${map.width()}x${map.height()} water=${map.isWater(anchor)} magnitude=${map.magnitude(anchor)}`,
  );
}
const lane = findTradeLane(map, mini);
if (lane === null) {
  console.log("lane: null");
} else {
  const mid = lane.path[(lane.path.length / 2) | 0];
  const mx = mid % map.width();
  console.log(
    `lane: ${lane.path.length} points, halfWidth=${lane.halfWidth}, center=(${mx},${(mid - mx) / map.width()}) centerWater=${map.isWater(mid)} centerMag=${map.magnitude(mid)}`,
  );
}

import {
  ConnectedComponents,
  LAND_MARKER,
} from "../pathfinding/algorithms/ConnectedComponents";
import { GameMap, TileRef } from "./GameMap";

/**
 * A static "central water route" corridor: the widest-open path through the
 * map's largest water body, found once at game init. All analysis is
 * integer-only and deterministic (fixed seed tiles, FIFO BFS order, Dial's
 * queue for the weighted path) so every client computes the identical lane.
 */
export interface TradeLane {
  /** Full-map water tiles tracing the corridor spine from end to end. */
  path: TileRef[];
  /** Corridor half-width in full-map tiles. */
  halfWidth: number;
  /** Full-map membership mask: 1 = tile is inside the corridor. */
  membership: Uint8Array;
}

// Magnitude (distance-from-coast, 0-31) at or above which a water tile is
// considered fully open; shallower tiles pay an extra cost per missing step
// so the spine prefers the middle of the largest water body.
const OPEN_WATER_MAGNITUDE = 10;
// Map-edge water is the "openest" of all (no coast beyond the border), which
// would glue the corridor to the map frame on island maps. Tiles closer than
// this margin to the map edge pay a cost per missing step, and corridor
// endpoints prefer interior tiles, so the route threads between the islands.
const EDGE_MARGIN_PERCENT = 10;
const MAX_EDGE_MARGIN = 24;
// The corridor is a compact stretch around its flag, not a map-spanning
// highway: the spine is trimmed to this % of the map's smaller dimension
// (never below a few widths so it still reads as a route).
const TARGET_LENGTH_PERCENT = 25;
const MIN_LENGTH_WIDTHS = 6;

function edgeMargin(miniMap: GameMap): number {
  const minDim = Math.min(miniMap.width(), miniMap.height());
  const margin = ((minDim * EDGE_MARGIN_PERCENT) / 100) | 0;
  return Math.min(MAX_EDGE_MARGIN, (minDim / 4) | 0, margin);
}
// Largest water component must cover at least this % of the minimap for a
// corridor to make sense; otherwise callers should fall back to the circle.
const MIN_COMPONENT_PERCENT = 4;
const MIN_HALF_WIDTH = 8;
const MAX_HALF_WIDTH = 24;

export function tradeLaneHalfWidth(
  mapWidth: number,
  mapHeight: number,
): number {
  const halfWidth = ((Math.min(mapWidth, mapHeight) * 5) / 100) | 0;
  return Math.max(MIN_HALF_WIDTH, Math.min(MAX_HALF_WIDTH, halfWidth));
}

/**
 * Find the central water corridor of the map, or null when the map has no
 * water body large enough to host one (callers fall back to the circular
 * objective). Analysis runs on the minimap (half resolution) and the result
 * is expressed in full-map tiles.
 */
export function findTradeLane(
  map: GameMap,
  miniMap: GameMap,
): TradeLane | null {
  const halfWidth = tradeLaneHalfWidth(map.width(), map.height());

  const component = largestWaterComponent(miniMap);
  if (component === null) return null;

  // The corridor grows outward from the open-water anchor (the map's most
  // open central sea): both endpoints are the farthest water tiles within
  // half the target length of the anchor. This keeps the route threading
  // the central waters instead of circling the islands along the cheap
  // open ocean at the map rim.
  const anchor = openWaterAnchorMini(miniMap, component);
  if (anchor === null) return null;

  const margin = edgeMargin(miniMap);
  const capMini = (targetMiniLength(map, halfWidth) / 2) | 0;
  const fromAnchor = bfsDistances(miniMap, component, anchor);
  const endA = farthestEligible(miniMap, fromAnchor, fromAnchor, capMini, margin);
  if (endA === null) return null;
  const fromA = bfsDistances(miniMap, component, endA);
  const endB = farthestEligible(miniMap, fromA, fromAnchor, capMini, margin);
  if (endB === null) return null;

  // Degenerate corridor: shorter than its own width once scaled to full map.
  if (fromA[endB] * 2 < halfWidth * 2) return null;

  const miniPath = openWaterPath(
    miniMap,
    component.cc,
    component.id,
    endA,
    endB,
    margin,
  );
  if (miniPath === null) return null;

  return buildLane(
    map,
    miniMap,
    trimToCenter(miniPath, map, halfWidth),
    halfWidth,
  );
}

/** Corridor target length in minimap tiles (half full-map resolution). */
function targetMiniLength(map: GameMap, halfWidth: number): number {
  const maxFullLength = Math.max(
    halfWidth * MIN_LENGTH_WIDTHS,
    ((Math.min(map.width(), map.height()) * TARGET_LENGTH_PERCENT) / 100) | 0,
  );
  return (maxFullLength / 2) | 0;
}

/**
 * Farthest tile by `rank` distance among tiles within `cap` of the anchor,
 * preferring tiles at least `margin` from the map edge (any tile within the
 * cap as fallback). Deterministic: strict-improvement scan in tile order.
 */
function farthestEligible(
  miniMap: GameMap,
  rank: Int32Array,
  fromAnchor: Int32Array,
  cap: number,
  margin: number,
): TileRef | null {
  const width = miniMap.width();
  const height = miniMap.height();
  let best = -1;
  let bestRank = -1;
  let fallback = -1;
  let fallbackRank = -1;
  for (let tile = 0; tile < rank.length; tile++) {
    if (rank[tile] === -1 || fromAnchor[tile] === -1 || fromAnchor[tile] > cap) {
      continue;
    }
    if (rank[tile] > fallbackRank) {
      fallbackRank = rank[tile];
      fallback = tile;
    }
    const x = tile % width;
    const y = (tile - x) / width;
    const distToEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
    if (distToEdge >= margin && rank[tile] > bestRank) {
      bestRank = rank[tile];
      best = tile;
    }
  }
  const chosen = best !== -1 ? best : fallback;
  return chosen === -1 ? null : (chosen as TileRef);
}

/**
 * Keep only the middle stretch of the spine so the objective is a compact
 * capture zone around the flag rather than a map-spanning highway. The full
 * path is still what anchors the corridor in the most open central water.
 */
function trimToCenter(
  miniPath: TileRef[],
  map: GameMap,
  halfWidth: number,
): TileRef[] {
  const maxMiniLength = targetMiniLength(map, halfWidth);
  if (miniPath.length <= maxMiniLength) return miniPath;

  const mid = (miniPath.length / 2) | 0;
  const start = Math.max(0, mid - ((maxMiniLength / 2) | 0));
  return miniPath.slice(start, start + maxMiniLength);
}

/**
 * Most open water tile of the map's largest water body, preferring tiles
 * near the map center. Used to anchor the Team-mode circular objective so
 * it never lands in a tiny inland bay next to the geometric map center.
 * Deterministic: strict improvement scan in tile order.
 */
export function findOpenWaterAnchor(
  map: GameMap,
  miniMap: GameMap,
): TileRef | null {
  const component = largestWaterComponent(miniMap);
  if (component === null) return null;

  const best = openWaterAnchorMini(miniMap, component);
  if (best === null) return null;

  const miniX = best % miniMap.width();
  const miniY = (best - miniX) / miniMap.width();
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = miniX * 2 + dx;
      const y = miniY * 2 + dy;
      if (!map.isValidCoord(x, y)) continue;
      const tile = map.ref(x, y);
      if (map.isWater(tile)) return tile;
    }
  }
  return null;
}

/** Minimap tile of the open-water anchor; see findOpenWaterAnchor. */
function openWaterAnchorMini(
  miniMap: GameMap,
  component: LargestComponent,
): TileRef | null {
  const width = miniMap.width();
  const height = miniMap.height();
  const centerX = (width / 2) | 0;
  const centerY = (height / 2) | 0;

  let best = -1;
  let bestOpenness = -1;
  let bestDist = 0;
  const numTiles = width * height;
  for (let tile = 0; tile < numTiles; tile++) {
    if (component.cc.getComponentId(tile as TileRef) !== component.id) {
      continue;
    }
    const x = tile % width;
    const y = (tile - x) / width;
    const distToEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
    // Map-edge water is "open" by magnitude but visually the map frame;
    // capping by edge distance keeps the anchor in real open sea.
    const openness = Math.min(miniMap.magnitude(tile as TileRef), distToEdge);
    const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
    if (
      openness > bestOpenness ||
      (openness === bestOpenness && dist < bestDist)
    ) {
      best = tile;
      bestOpenness = openness;
      bestDist = dist;
    }
  }
  return best === -1 ? null : (best as TileRef);
}

interface LargestComponent {
  cc: ConnectedComponents;
  id: number;
}

function largestWaterComponent(miniMap: GameMap): LargestComponent | null {
  const cc = new ConnectedComponents(miniMap);
  cc.initialize();

  const numTiles = miniMap.width() * miniMap.height();
  const sizes = new Map<number, number>();
  for (let tile = 0; tile < numTiles; tile++) {
    const id = cc.getComponentId(tile as TileRef);
    if (id === 0 || id === LAND_MARKER) continue;
    sizes.set(id, (sizes.get(id) ?? 0) + 1);
  }

  let bestId = 0;
  let bestSize = 0;
  for (const [id, size] of sizes) {
    if (size > bestSize || (size === bestSize && id < bestId)) {
      bestId = id;
      bestSize = size;
    }
  }

  if (bestId === 0 || bestSize * 100 < numTiles * MIN_COMPONENT_PERCENT) {
    return null;
  }
  return { cc, id: bestId };
}

/**
 * Plain FIFO BFS over one water component. Returns per-tile distances from
 * `start` (-1 = unreached), deterministic given the fixed neighbor order.
 */
function bfsDistances(
  miniMap: GameMap,
  component: LargestComponent,
  start: TileRef,
): Int32Array {
  const cc = component.cc;
  const componentId = component.id;
  const width = miniMap.width();
  const numTiles = width * miniMap.height();
  const dist = new Int32Array(numTiles).fill(-1);
  const queue = new Int32Array(numTiles);
  let head = 0;
  let tail = 0;

  dist[start] = 0;
  queue[tail++] = start;

  while (head < tail) {
    const tile = queue[head++];
    const d = dist[tile] + 1;
    const x = tile % width;
    // Neighbor order fixed (up, down, left, right) for determinism.
    if (tile >= width) visit(tile - width);
    if (tile < numTiles - width) visit(tile + width);
    if (x > 0) visit(tile - 1);
    if (x < width - 1) visit(tile + 1);

    function visit(n: number): void {
      if (dist[n] !== -1 || cc.getComponentId(n as TileRef) !== componentId) {
        return;
      }
      dist[n] = d;
      queue[tail++] = n;
    }
  }

  return dist;
}

/**
 * Dijkstra via Dial's bucket queue (integer costs, deterministic FIFO order
 * within each bucket). Step cost is 1 for open water and grows as the tile
 * gets closer to a coastline or to the map edge, so the path drifts toward
 * open water while threading between islands instead of hugging the border.
 */
function openWaterPath(
  miniMap: GameMap,
  cc: ConnectedComponents,
  componentId: number,
  from: TileRef,
  to: TileRef,
  margin: number,
): TileRef[] | null {
  const width = miniMap.width();
  const height = miniMap.height();
  const numTiles = width * height;
  const maxStepCost = 1 + OPEN_WATER_MAGNITUDE + margin;
  const numBuckets = maxStepCost + 1;

  const dist = new Int32Array(numTiles).fill(-1);
  const parent = new Int32Array(numTiles).fill(-1);
  const buckets: number[][] = [];
  const bucketHeads = new Int32Array(numBuckets);
  for (let i = 0; i < numBuckets; i++) buckets.push([]);

  dist[from] = 0;
  buckets[0].push(from);
  let currentDist = 0;
  let remaining = 1;

  while (remaining > 0) {
    const slot = currentDist % numBuckets;
    const bucket = buckets[slot];
    if (bucketHeads[slot] >= bucket.length) {
      bucket.length = 0;
      bucketHeads[slot] = 0;
      currentDist++;
      continue;
    }
    const tile = bucket[bucketHeads[slot]++];
    remaining--;
    if (dist[tile] !== currentDist) continue; // stale entry
    if (tile === to) break;

    const x = tile % width;
    if (tile >= width) relax(tile, tile - width);
    if (tile < numTiles - width) relax(tile + 0, tile + width);
    if (x > 0) relax(tile, tile - 1);
    if (x < width - 1) relax(tile, tile + 1);
  }

  function relax(fromTile: number, n: number): void {
    if (cc.getComponentId(n as TileRef) !== componentId) return;
    const magnitude = miniMap.magnitude(n as TileRef);
    const shortfall =
      magnitude >= OPEN_WATER_MAGNITUDE ? 0 : OPEN_WATER_MAGNITUDE - magnitude;
    const nx = n % width;
    const ny = (n - nx) / width;
    const distToEdge = Math.min(nx, ny, width - 1 - nx, height - 1 - ny);
    const edgePenalty = distToEdge >= margin ? 0 : margin - distToEdge;
    const next = dist[fromTile] + 1 + shortfall + edgePenalty;
    if (dist[n] !== -1 && dist[n] <= next) return;
    dist[n] = next;
    parent[n] = fromTile;
    buckets[next % numBuckets].push(n);
    remaining++;
  }

  if (dist[to] === -1) return null;

  const path: TileRef[] = [];
  let cursor: number = to;
  while (cursor !== -1) {
    path.push(cursor as TileRef);
    cursor = parent[cursor];
  }
  path.reverse();
  return path;
}

/**
 * Scale the minimap spine to full-map water tiles and grow the membership
 * mask around it with a multi-source BFS through water, capped at halfWidth.
 */
function buildLane(
  map: GameMap,
  miniMap: GameMap,
  miniPath: TileRef[],
  halfWidth: number,
): TradeLane | null {
  const width = map.width();
  const height = map.height();
  const numTiles = width * height;
  const miniWidth = miniMap.width();

  const membership = new Uint8Array(numTiles);
  const depth = new Int32Array(numTiles).fill(-1);
  const queue = new Int32Array(numTiles);
  let tail = 0;
  const path: TileRef[] = [];

  for (const miniTile of miniPath) {
    const miniX = miniTile % miniWidth;
    const miniY = (miniTile - miniX) / miniWidth;
    let spineTile = -1;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = miniX * 2 + dx;
        const y = miniY * 2 + dy;
        if (!map.isValidCoord(x, y)) continue;
        const tile = map.ref(x, y);
        if (!map.isWater(tile)) continue;
        if (spineTile === -1) spineTile = tile;
        if (depth[tile] === -1) {
          depth[tile] = 0;
          membership[tile] = 1;
          queue[tail++] = tile;
        }
      }
    }
    if (spineTile !== -1) path.push(spineTile as TileRef);
  }

  if (path.length === 0) return null;

  let head = 0;
  while (head < tail) {
    const tile = queue[head++];
    const d = depth[tile] + 1;
    if (d > halfWidth) continue;
    const x = tile % width;
    if (tile >= width) visit(tile - width);
    if (tile < numTiles - width) visit(tile + width);
    if (x > 0) visit(tile - 1);
    if (x < width - 1) visit(tile + 1);

    function visit(n: number): void {
      if (depth[n] !== -1 || !map.isWater(n as TileRef)) return;
      depth[n] = d;
      membership[n] = 1;
      queue[tail++] = n;
    }
  }

  return { path, halfWidth, membership };
}

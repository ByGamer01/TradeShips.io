import { Game } from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";

/**
 * Picks a random water tile around a patrol center, staying in the same
 * water component as the patrolling unit. Mirrors the warship patrol
 * behavior: expands the search radius when the area is too constrained and
 * falls back to shoreline tiles as a last resort.
 */
export function randomPatrolTile(
  mg: Game,
  random: PseudoRandom,
  patrolCenter: TileRef,
  unitTile: TileRef,
  patrolRange: number,
  allowShoreline = false,
): TileRef | undefined {
  const maxAttemptsBeforeExpand = 500;
  const unitComponent = mg.getWaterComponent(unitTile);
  let range = patrolRange;
  let attempts = 0;
  let expandCount = 0;

  while (expandCount < 3) {
    const x = mg.x(patrolCenter) + random.nextInt(-range / 2, range / 2);
    const y = mg.y(patrolCenter) + random.nextInt(-range / 2, range / 2);
    if (!mg.isValidCoord(x, y)) {
      continue;
    }
    const tile = mg.ref(x, y);
    const validWater =
      mg.isWater(tile) &&
      (allowShoreline || !mg.isShoreline(tile)) &&
      (unitComponent === null || mg.hasWaterComponent(tile, unitComponent));
    if (!validWater) {
      attempts++;
      if (attempts === maxAttemptsBeforeExpand) {
        expandCount++;
        attempts = 0;
        range = range + Math.floor(range / 2);
      }
      continue;
    }
    return tile;
  }

  if (!allowShoreline) {
    return randomPatrolTile(mg, random, patrolCenter, unitTile, patrolRange, true);
  }
  return undefined;
}

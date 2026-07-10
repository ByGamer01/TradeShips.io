import { GameMapType } from "./Maps.gen";

export const MARITIME_MAPS: ReadonlySet<GameMapType> = new Set([
  // TradeShips identity: maps should feel like islands/archipelagos, not
  // continental conquest or pure strait/river chokepoint maps.
  GameMapType.Aegean,
  GameMapType.ArchipelagoSea,
  GameMapType.Britannia,
  GameMapType.Caribbean,
  GameMapType.FalklandIslands,
  GameMapType.FaroeIslands,
  GameMapType.FourIslands,
  GameMapType.Hawaii,
  GameMapType.Iceland,
  GameMapType.Japan,
  GameMapType.Lemnos,
  GameMapType.Oceania,
  GameMapType.SoutheastAsia,
  GameMapType.Svalmel,
]);

export function isMaritimeMap(map: GameMapType): boolean {
  return MARITIME_MAPS.has(map);
}

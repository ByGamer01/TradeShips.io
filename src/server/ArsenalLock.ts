import { DISABLED_ARSENAL } from "../core/game/Game";
import { GameConfig } from "../core/Schemas";

/**
 * Server-side authority guard for the naval-trim arsenal lock (ADR-4).
 *
 * Normalizes a GameConfig so the arsenal (DISABLED_ARSENAL) can never be
 * re-enabled, even by a manipulated client that sends an empty
 * `disabledUnits` array or `waterNukes: true`. This is defense-in-depth on
 * top of the server/client defaults — not a hard rejection, since rejecting
 * would break lobby creation.
 *
 * Pure function: returns a new config object, never mutates the input.
 */
export function enforceArsenalLock(config: GameConfig): GameConfig {
  return {
    ...config,
    disabledUnits: Array.from(
      new Set([...(config.disabledUnits ?? []), ...DISABLED_ARSENAL]),
    ),
    waterNukes: undefined,
  };
}

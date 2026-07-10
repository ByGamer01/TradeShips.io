import { Difficulty, Game } from "../../game/Game";

/**
 * Difficulty as experienced by nation AI. TradeShips nations always play at
 * least Hard regardless of the selected game difficulty (Impossible is kept),
 * so games stay pressured even on Easy/Medium lobbies. The raw game
 * difficulty still applies to everything that is not nation behavior.
 */
export function nationDifficulty(game: Game): Difficulty {
  const difficulty = game.config().gameConfig().difficulty;
  if (difficulty === Difficulty.Easy || difficulty === Difficulty.Medium) {
    return Difficulty.Hard;
  }
  return difficulty;
}

export interface LobbyBotFillOptions {
  /** Real connected players. */
  humans: number;
  maxPlayers: number;
  /** When the lobby became publicly visible (ms epoch). */
  visibleAt: number | undefined;
  /** Scheduled game start (ms epoch). */
  startsAt: number | undefined;
  now: number;
}

/**
 * Displayed player count for a public lobby: the human count topped up with
 * phantom bots that trickle in as the start time approaches, so lobbies never
 * look empty. Humans "replace" bots — the displayed count never drops below
 * the real human count and never exceeds maxPlayers. At game start the count
 * reaches maxPlayers, matching GameServer.startGameConfig(), which fills the
 * remaining slots with in-game bots.
 */
export function lobbyBotFillCount(options: LobbyBotFillOptions): number {
  const { humans, maxPlayers, visibleAt, startsAt, now } = options;
  if (
    maxPlayers <= 0 ||
    visibleAt === undefined ||
    startsAt === undefined ||
    startsAt <= visibleAt
  ) {
    return humans;
  }
  const fraction = Math.min(
    1,
    Math.max(0, (now - visibleAt) / (startsAt - visibleAt)),
  );
  return Math.min(maxPlayers, Math.max(humans, Math.ceil(fraction * maxPlayers)));
}

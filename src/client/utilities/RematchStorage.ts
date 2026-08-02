/**
 * Storage handshake between HostLobbyModal (writes the full settings snapshot
 * when a private game starts) and WinModal (offers "rematch" at game end when
 * the finished game is the one the local player hosted).
 */
export const REMATCH_CONFIG_KEY = "rematchConfig";

/** gameID of the last private game hosted from this browser, if any. */
export function lastHostedGameID(): string | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(REMATCH_CONFIG_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "gameID" in parsed &&
      typeof (parsed as { gameID: unknown }).gameID === "string"
    ) {
      return (parsed as { gameID: string }).gameID;
    }
  } catch {
    // fall through
  }
  return null;
}

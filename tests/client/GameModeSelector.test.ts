import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientEnv } from "../../src/client/ClientEnv";
import { GameModeSelector } from "../../src/client/GameModeSelector";
import {
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../../src/core/game/Game";

describe("GameModeSelector lobby card layout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("centers the lone desktop lobby card when no side lobbies are available", () => {
    const selector = new GameModeSelector();

    (selector as any).defaultLobbyTime = 5;
    (selector as any).serverTimeOffset = 0;
    (selector as any).lobbies = {
      serverTime: Date.now(),
      games: {
        ffa: [
          {
            gameID: "ffa-only",
            numClients: 0,
            startsAt: Date.now() + 5000,
            gameConfig: {
              gameMap: GameMapType.StraitOfMalacca,
              gameMapSize: GameMapSize.Normal,
              gameMode: GameMode.FFA,
              gameType: GameType.Public,
              maxPlayers: 25,
            },
          },
        ],
      },
    };

    const rendered = JSON.stringify(selector.render());

    expect(rendered).not.toContain("sm:grid-cols-[2fr_1fr]");
    expect(rendered).toContain("sm:grid-rows-[minmax(0,1fr)]");
    expect(rendered).toContain("sm:w-2/3 sm:mx-auto");
  });

  it("allows mobile action buttons to shrink inside narrow viewports", () => {
    const selector = new GameModeSelector();

    const rendered = JSON.stringify(selector.render());

    expect(rendered).toContain("grid-cols-[repeat(3,minmax(0,1fr))]");
    expect(rendered).toContain("min-w-0");
    expect(rendered).toContain("text-xs sm:text-sm");
  });

  it("refreshes the lobby countdown every second without waiting for socket updates", () => {
    vi.useFakeTimers();
    vi.spyOn(ClientEnv, "gameCreationRate").mockReturnValue(5000);
    const selector = new GameModeSelector();
    (selector as any).lobbySocket = { start: vi.fn(), stop: vi.fn() };
    (selector as any).lobbies = {
      serverTime: Date.now(),
      games: {
        ffa: [
          {
            gameID: "countdown",
            numClients: 0,
            startsAt: Date.now() + 5000,
            gameConfig: {
              gameMap: GameMapType.StraitOfMalacca,
              gameMapSize: GameMapSize.Normal,
              gameMode: GameMode.FFA,
              gameType: GameType.Public,
              maxPlayers: 25,
            },
          },
        ],
      },
    };
    const requestUpdate = vi.spyOn(selector, "requestUpdate");

    selector.connectedCallback();
    requestUpdate.mockClear();

    vi.advanceTimersByTime(1000);

    expect(requestUpdate).toHaveBeenCalled();

    selector.disconnectedCallback();
    requestUpdate.mockClear();
    vi.advanceTimersByTime(1000);

    expect(requestUpdate).not.toHaveBeenCalled();
  });
});

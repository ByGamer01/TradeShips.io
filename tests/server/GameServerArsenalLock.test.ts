import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/Schemas", async () => {
  const actual = (await vi.importActual("../../src/core/Schemas")) as any;
  return {
    ...actual,
    GameStartInfoSchema: {
      safeParse: (data: any) => ({ success: true, data: data }),
    },
    ServerPrestartMessageSchema: {
      safeParse: (data: any) => ({ success: true, data: data }),
    },
  };
});

import { DISABLED_ARSENAL, GameType } from "../../src/core/game/Game";
import { GameServer } from "../../src/server/GameServer";

describe("GameServer arsenal lock (server authority guard)", () => {
  let mockLogger: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLogger = {
      child: vi.fn().mockReturnThis(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it("re-locks the arsenal immediately at construction, even if the incoming config tries to reactivate it", () => {
    const game = new GameServer("test-game", mockLogger, Date.now(), {
      gameType: GameType.Private,
      disabledUnits: [],
      waterNukes: true,
    } as any);

    for (const unit of DISABLED_ARSENAL) {
      expect(game.gameConfig.disabledUnits).toContain(unit);
    }
    expect(game.gameConfig.waterNukes).toBeFalsy();
  });

  it("keeps the arsenal locked after a simulated manipulated client update", () => {
    const game = new GameServer("test-game", mockLogger, Date.now(), {
      gameType: GameType.Private,
      disabledUnits: [...DISABLED_ARSENAL],
    } as any);

    // Simulate a manipulated client sending an empty disabledUnits override.
    game.updateGameConfig({ disabledUnits: [] });

    for (const unit of DISABLED_ARSENAL) {
      expect(game.gameConfig.disabledUnits).toContain(unit);
    }
  });
});

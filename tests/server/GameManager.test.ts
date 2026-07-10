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

import { DISABLED_ARSENAL } from "../../src/core/game/Game";
import { GameManager } from "../../src/server/GameManager";

describe("GameManager arsenal lock defaults", () => {
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

  it("defaults private games created without a gameConfig to the full arsenal disabled", () => {
    const manager = new GameManager(mockLogger);
    const game = manager.createGame("id1", undefined);

    expect(game).not.toBeNull();
    for (const unit of DISABLED_ARSENAL) {
      expect(game!.gameConfig.disabledUnits).toContain(unit);
    }
  });

  it("re-locks the arsenal even when the caller explicitly passes an empty disabledUnits override (server authority guard, ADR-4)", () => {
    // Behavior change from WU-3: GameServer's constructor now runs
    // enforceArsenalLock on every incoming config, so an explicit
    // `disabledUnits: []` override (e.g. a manipulated client) is no longer
    // honored verbatim — the arsenal floor always wins.
    const manager = new GameManager(mockLogger);
    const game = manager.createGame("id2", { disabledUnits: [] } as any);

    expect(game).not.toBeNull();
    for (const unit of DISABLED_ARSENAL) {
      expect(game!.gameConfig.disabledUnits).toContain(unit);
    }
  });
});

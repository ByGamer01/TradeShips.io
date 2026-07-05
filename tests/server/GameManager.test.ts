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

  it("documents current behavior: an explicit empty disabledUnits override is honored pre-server-guard (WU-3 revisits this)", () => {
    const manager = new GameManager(mockLogger);
    const game = manager.createGame("id2", { disabledUnits: [] } as any);

    expect(game).not.toBeNull();
    expect(game!.gameConfig.disabledUnits).toEqual([]);
  });
});

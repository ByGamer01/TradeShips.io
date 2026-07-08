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

import { GameType } from "../../src/core/game/Game";
import { Client } from "../../src/server/Client";
import { GameServer } from "../../src/server/GameServer";

function makeMockWs() {
  return {
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  };
}

function makeClient(clientID: string): {
  client: Client;
  ws: ReturnType<typeof makeMockWs>;
} {
  const ws = makeMockWs();
  const client = new Client(
    clientID,
    `${clientID}-persistent`,
    null,
    null,
    undefined,
    "127.0.0.1",
    clientID,
    null,
    ws as any,
    undefined,
    undefined,
    [],
  );
  return { client, ws };
}

describe("GameServer public bot fill", () => {
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

  it("replaces fill bots with joined humans in public game start config", () => {
    const game = new GameServer(
      "public-game",
      mockLogger,
      Date.now(),
      {
        gameType: GameType.Public,
        maxPlayers: 5,
        bots: 400,
      } as any,
      undefined,
      Date.now() + 5_000,
      "ffa",
    );
    const { client: a, ws: wsA } = makeClient("a");
    const { client: b } = makeClient("b");

    game.joinClient(a);
    game.joinClient(b);
    game.start();

    const startMessage = vi
      .mocked(wsA.send)
      .mock.calls.map(([payload]) => JSON.parse(payload))
      .find((message) => message.type === "start");

    expect(startMessage).toBeDefined();
    expect(startMessage.gameStartInfo.config.bots).toBe(3);
  });
});

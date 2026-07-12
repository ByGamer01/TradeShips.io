import { afterEach, describe, expect, test, vi } from "vitest";
import { GameType } from "../../src/core/game/Game";

vi.mock("../../src/server/ServerEnv", () => ({
  ServerEnv: {
    externalApiEnabled: () => false,
    jwtIssuer: () => "https://api.tradeships.io",
    apiKey: () => "unused",
    gitCommit: () => "DEV",
    subdomain: () => "main",
    domain: () => "tradeships.io",
  },
}));

vi.mock("../../src/server/Logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { archive, readGameRecord } from "../../src/server/Archive";

describe("Archive alpha mode without external API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("does not call the external archive API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await archive({
      info: {
        gameID: "ALPHA123",
        config: { gameType: GameType.Public },
        players: [],
      },
      version: "v0.0.0",
      gitCommit: "DEV",
      subdomain: "main",
      domain: "tradeships.io",
      turns: [],
    } as any);

    await expect(readGameRecord("ALPHA123" as any)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

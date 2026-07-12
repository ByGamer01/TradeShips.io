import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getPlayToken } from "../src/client/Auth";
import { ClientEnv } from "../src/client/ClientEnv";

describe("Auth alpha mode without external API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    ClientEnv.reset();
    window.BOOTSTRAP_CONFIG = {
      gameEnv: "prod",
      numWorkers: 2,
      turnstileSiteKey: "k",
      jwtAudience: "tradeships.io",
      instanceId: "x",
      gitCommit: "abc123",
      externalApiEnabled: false,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.BOOTSTRAP_CONFIG = undefined;
    ClientEnv.reset();
  });

  test("uses anonymous persistent ID without calling /auth/refresh", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchSpy);

    const token = await getPlayToken();

    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/server/ServerEnv", () => ({
  ServerEnv: {
    externalApiEnabled: () => false,
    jwtIssuer: () => "https://api.tradeships.io",
    apiKey: () => "unused",
  },
}));

import { verifyTurnstileToken } from "../../src/server/Turnstile";

describe("verifyTurnstileToken alpha mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("approves without calling the external API when API integration is disabled", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(verifyTurnstileToken("127.0.0.1", null)).resolves.toEqual({
      status: "approved",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

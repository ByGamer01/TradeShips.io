import { lobbyBotFillCount } from "../../src/server/LobbyBotFill";

describe("lobbyBotFillCount", () => {
  const base = {
    humans: 0,
    maxPlayers: 50,
    visibleAt: 1_000,
    startsAt: 61_000, // 60s lobby window
  };

  test("shows only humans when the lobby has no schedule yet", () => {
    expect(
      lobbyBotFillCount({ ...base, humans: 3, startsAt: undefined, now: 5_000 }),
    ).toBe(3);
    expect(
      lobbyBotFillCount({ ...base, humans: 3, visibleAt: undefined, now: 5_000 }),
    ).toBe(3);
  });

  test("ramps the displayed count from empty to full across the lobby window", () => {
    expect(lobbyBotFillCount({ ...base, now: 1_000 })).toBe(0);
    expect(lobbyBotFillCount({ ...base, now: 31_000 })).toBe(25);
    expect(lobbyBotFillCount({ ...base, now: 61_000 })).toBe(50);
  });

  test("never exceeds maxPlayers even past the start time", () => {
    expect(lobbyBotFillCount({ ...base, now: 90_000 })).toBe(50);
    expect(lobbyBotFillCount({ ...base, humans: 50, now: 90_000 })).toBe(50);
  });

  test("humans replace bots: displayed count never drops below real humans", () => {
    expect(lobbyBotFillCount({ ...base, humans: 40, now: 31_000 })).toBe(40);
    // ...and bots never push the count down once humans exceed the ramp
    expect(lobbyBotFillCount({ ...base, humans: 10, now: 31_000 })).toBe(25);
  });

  test("is monotonic in time for a fixed human count", () => {
    let prev = 0;
    for (let now = 1_000; now <= 61_000; now += 5_000) {
      const count = lobbyBotFillCount({ ...base, humans: 5, now });
      expect(count).toBeGreaterThanOrEqual(prev);
      prev = count;
    }
  });

  test("degenerate windows fall back to humans only", () => {
    expect(
      lobbyBotFillCount({
        ...base,
        humans: 2,
        visibleAt: 61_000,
        startsAt: 61_000,
        now: 61_000,
      }),
    ).toBe(2);
    expect(
      lobbyBotFillCount({ ...base, humans: 2, maxPlayers: 0, now: 31_000 }),
    ).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { nationDifficulty } from "../../../src/core/execution/utils/NationDifficulty";
import { Difficulty } from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

describe("nationDifficulty", () => {
  it.each([
    [Difficulty.Easy, Difficulty.Hard],
    [Difficulty.Medium, Difficulty.Hard],
    [Difficulty.Hard, Difficulty.Hard],
    [Difficulty.Impossible, Difficulty.Impossible],
  ])("clamps %s to %s for nation AI", async (selected, effective) => {
    const game = await setup("plains", { difficulty: selected });

    expect(nationDifficulty(game)).toBe(effective);
  });
});

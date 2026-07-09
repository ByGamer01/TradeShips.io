import { describe, expect, test } from "vitest";
import {
  Difficulty,
  Nation,
  PlayerInfo,
  PlayerType,
} from "../../../src/core/game/Game";
import { NationExecution } from "../../../src/core/execution/NationExecution";

function makeExecution(difficulty: Difficulty): NationExecution {
  const nation = new Nation(
    undefined,
    new PlayerInfo("Test Nation", PlayerType.Nation, null, "nation"),
  );
  const execution = new NationExecution("game", nation);
  (execution as any).mg = {
    config: () => ({
      gameConfig: () => ({ difficulty }),
    }),
  };
  return execution;
}

describe("NationExecution difficulty tuning", () => {
  test("impossible nations reserve less and expand earlier", () => {
    const execution = makeExecution(Difficulty.Impossible);

    (execution as any).tuneBehaviorRatios();

    expect((execution as any).triggerRatio).toBeGreaterThanOrEqual(0.4);
    expect((execution as any).triggerRatio).toBeLessThan(0.48);
    expect((execution as any).reserveRatio).toBeGreaterThanOrEqual(0.2);
    expect((execution as any).reserveRatio).toBeLessThan(0.28);
    expect((execution as any).expandRatio).toBeGreaterThanOrEqual(0.26);
    expect((execution as any).expandRatio).toBeLessThan(0.4);
  });

  test("hard and impossible nations react faster than legacy medium pacing", () => {
    const hardRate = (makeExecution(Difficulty.Hard) as any).getAttackRate();
    const impossibleRate = (makeExecution(Difficulty.Impossible) as any)
      .getAttackRate();

    expect(hardRate).toBeGreaterThanOrEqual(35);
    expect(hardRate).toBeLessThan(50);
    expect(impossibleRate).toBeGreaterThanOrEqual(25);
    expect(impossibleRate).toBeLessThan(40);
  });
});

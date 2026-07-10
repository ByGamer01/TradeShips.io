import { describe, expect, test, vi } from "vitest";
import { ConstructionExecution } from "../../../src/core/execution/ConstructionExecution";
import { TribeExecution } from "../../../src/core/execution/TribeExecution";
import { UnitType } from "../../../src/core/game/Game";

function makeGame() {
  return {
    addExecution: vi.fn(),
    config: () => ({
      isUnitDisabled: () => false,
    }),
    unitInfo: () => ({
      cost: () => 0n,
    }),
  };
}

describe("TribeExecution naval building", () => {
  test("queues port construction when a tribe has a valid shore", () => {
    const shoreTile = 42;
    const tribe = {
      id: () => "tribe",
      borderTiles: () => new Set([shoreTile]),
      canBuild: vi.fn(() => shoreTile),
      gold: () => 10_000n,
      numTilesOwned: () => 4000,
      tiles: () => new Set([shoreTile]),
      unitCount: () => 0,
    };
    const game = makeGame();
    const execution = new TribeExecution(tribe as any);
    execution.init(game as any);
    (execution as any).random = { shuffleArray: (items: number[]) => items };

    expect((execution as any).maybeBuildPort()).toBe(true);
    expect(game.addExecution).toHaveBeenCalledWith(
      expect.any(ConstructionExecution),
    );
    expect(tribe.canBuild).toHaveBeenCalledWith(UnitType.Port, shoreTile);
  });

  test("does not delete tribe ports during cleanup", () => {
    const port = {
      id: () => 7,
      isMarkedForDeletion: () => false,
      type: () => UnitType.Port,
    };
    const tribe = {
      canDeleteUnit: () => true,
      id: () => "tribe",
      units: () => [port],
    };
    const game = makeGame();
    const execution = new TribeExecution(tribe as any);
    execution.init(game as any);

    (execution as any).deleteNextStructure();

    expect(game.addExecution).not.toHaveBeenCalled();
  });
});

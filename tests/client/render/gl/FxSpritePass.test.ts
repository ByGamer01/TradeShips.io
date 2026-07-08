import { describe, expect, it, vi } from "vitest";
import {
  FX_MINI_EXPLOSION,
  FxSpritePass,
} from "../../../../src/client/render/gl/passes/fx-pass/FxSpritePass";
import { UT_TORPEDO } from "../../../../src/client/render/types";

describe("FxSpritePass.spawnFxForUnit", () => {
  it("spawns a mini explosion when a torpedo reaches its target", () => {
    const pass = Object.create(FxSpritePass.prototype) as FxSpritePass;
    Object.assign(pass, {
      mapW: 100,
      pushFx: vi.fn(),
    });

    pass.spawnFxForUnit(
      {
        unitType: UT_TORPEDO,
        pos: 205,
        reachedTarget: true,
      } as any,
      1234,
    );

    expect((pass as any).pushFx).toHaveBeenCalledWith(
      5,
      2,
      FX_MINI_EXPLOSION,
      1234,
    );
  });
});

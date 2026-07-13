import { describe, expect, it, vi } from "vitest";
import {
  FX_MINI_EXPLOSION,
  FX_SINKING_SHIP,
  FX_UNIT_EXPLOSION,
  FxSpritePass,
} from "../../../../src/client/render/gl/passes/fx-pass/FxSpritePass";
import {
  UT_CARRIER,
  UT_SUBMARINE,
  UT_TORPEDO,
  UT_WARSHIP,
} from "../../../../src/client/render/types";

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

  it.each([UT_SUBMARINE, UT_CARRIER])(
    "does not use the warship sinking sprite for %s",
    (unitType) => {
      const pass = Object.create(FxSpritePass.prototype) as FxSpritePass;
      const pushFx = vi.fn();
      Object.assign(pass, { mapW: 100, pushFx });

      pass.spawnFxForUnit(
        { unitType, pos: 205, reachedTarget: false } as any,
        1234,
      );

      expect(pushFx).toHaveBeenCalledOnce();
      expect(pushFx).toHaveBeenCalledWith(5, 2, FX_UNIT_EXPLOSION, 1234);
      expect(pushFx).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        FX_SINKING_SHIP,
        expect.anything(),
      );
    },
  );

  it("keeps the sinking sprite for warships", () => {
    const pass = Object.create(FxSpritePass.prototype) as FxSpritePass;
    const pushFx = vi.fn();
    Object.assign(pass, { mapW: 100, pushFx });

    pass.spawnFxForUnit(
      { unitType: UT_WARSHIP, pos: 205, reachedTarget: false } as any,
      1234,
    );

    expect(pushFx).toHaveBeenCalledWith(5, 2, FX_UNIT_EXPLOSION, 1234);
    expect(pushFx).toHaveBeenCalledWith(5, 2, FX_SINKING_SHIP, 1234);
  });
});

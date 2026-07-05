import { DISABLED_ARSENAL, UnitType } from "../src/core/game/Game";

describe("DISABLED_ARSENAL", () => {
  test("contains exactly the 8 arsenal unit types", () => {
    expect(DISABLED_ARSENAL).toHaveLength(8);
    expect(new Set(DISABLED_ARSENAL)).toEqual(
      new Set([
        UnitType.AtomBomb,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
        UnitType.MIRVWarhead,
        UnitType.MissileSilo,
        UnitType.SAMLauncher,
        UnitType.SAMMissile,
        UnitType.DefensePost,
      ]),
    );
  });

  test("never disables a child projectile without its parent (parent-child invariant)", () => {
    if (DISABLED_ARSENAL.includes(UnitType.MIRVWarhead)) {
      expect(DISABLED_ARSENAL).toContain(UnitType.MIRV);
    }
    if (DISABLED_ARSENAL.includes(UnitType.SAMMissile)) {
      expect(DISABLED_ARSENAL).toContain(UnitType.SAMLauncher);
    }
  });
});

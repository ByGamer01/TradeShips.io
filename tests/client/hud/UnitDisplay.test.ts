import { describe, expect, it, vi } from "vitest";
import { UnitDisplay } from "../../../src/client/hud/layers/UnitDisplay";
import { DISABLED_ARSENAL, UnitType } from "../../../src/core/game/Game";

function collectRenderableText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "function" || typeof value === "bigint") return "";
  if (Array.isArray(value)) return value.map(collectRenderableText).join(" ");
  if (typeof value === "object") {
    return Object.values(value).map(collectRenderableText).join(" ");
  }
  return "";
}

describe("UnitDisplay naval quickbar", () => {
  it("renders naval units in the bottom build bar when the arsenal lock is active", () => {
    const el = new UnitDisplay();
    const config = {
      isUnitDisabled: (unit: UnitType) => DISABLED_ARSENAL.includes(unit),
    };
    const player = {
      gold: () => 1_000_000n,
      isAlive: () => true,
      totalUnitLevels: () => 0,
      units: () => [],
    };

    el.game = {
      config: () => config,
      inSpawnPhase: () => false,
      myPlayer: () => player,
    } as any;
    el.eventBus = { emit: vi.fn() } as any;
    el.uiState = { ghostStructure: null } as any;
    (el as any).playerBuildables = [
      { type: UnitType.City, cost: 0n, canBuild: true },
      { type: UnitType.Factory, cost: 0n, canBuild: true },
      { type: UnitType.Port, cost: 0n, canBuild: true },
      { type: UnitType.Warship, cost: 0n, canBuild: true },
      { type: UnitType.Submarine, cost: 0n, canBuild: true },
      { type: UnitType.AircraftCarrier, cost: 0n, canBuild: true },
      { type: UnitType.NavalMine, cost: 0n, canBuild: true },
    ];

    const rendered = collectRenderableText(el.render());

    expect(rendered).toContain("submarine");
    expect(rendered).toContain("aircraft_carrier");
    expect(rendered).toContain("naval_mine");
    expect(rendered).toContain("/images/SubmarineIconWhite.svg");
    expect(rendered).toContain("/images/AircraftCarrierIconWhite.svg");
    expect(rendered).toContain("/images/NavalMineIconWhite.svg");
    expect(rendered).not.toContain("atom_bomb");
    expect(rendered).not.toContain("missile_silo");
  });

  it("renders a compact own trade-route risk summary", () => {
    const el = new UnitDisplay();
    const config = {
      isUnitDisabled: (unit: UnitType) => DISABLED_ARSENAL.includes(unit),
    };
    const player = {
      gold: () => 1_000_000n,
      isAlive: () => true,
      totalUnitLevels: () => 0,
      units: () => [],
    };

    el.game = {
      config: () => config,
      frameData: () => ({
        tradeRoutes: [
          {
            relation: "own",
            riskLevel: "safe",
            escortCount: 1,
            estimatedGold: 120_000,
          },
          {
            relation: "own",
            riskLevel: "contested",
            escortCount: 2,
            estimatedGold: 80_000,
          },
          { relation: "own", riskLevel: "dangerous", escortCount: 0 },
          { relation: "friendly", riskLevel: "dangerous", escortCount: 9 },
        ],
      }),
      inSpawnPhase: () => false,
      myPlayer: () => player,
    } as any;
    el.eventBus = { emit: vi.fn() } as any;
    el.uiState = { ghostStructure: null } as any;

    const rendered = collectRenderableText(el.render());

    expect(rendered).toContain("Routes");
    expect(rendered).toContain("3");
    expect(rendered).toContain("Contested");
    expect(rendered).toContain("1");
    expect(rendered).toContain("Danger");
    expect(rendered).toContain("1");
    expect(rendered).toContain("Escorts");
    expect(rendered).toContain("3");
    expect(rendered).toContain("Value");
    expect(rendered).toContain("200K");
    expect(rendered).toContain("Risk");
  });
});

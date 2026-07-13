import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { setup } from "../util/Setup";

describe("debt economy", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup("half_land_half_ocean", {}, [
      new PlayerInfo("debtor", PlayerType.Human, null, "debtor_id"),
    ]);
    player = game.player("debtor_id");
  });

  describe("war spending", () => {
    test("accrues the unpaid war bill as debt instead of forgiving it", () => {
      expect(player.gold()).toBe(0n);

      const spent = player.updateWarEconomy(1, 1_000n);

      expect(spent).toBe(0n);
      expect(player.debt()).toBeGreaterThan(0n);
    });

    test("only the treasury shortfall becomes debt on a partial payment", () => {
      player.addGold(100n);

      const spent = player.updateWarEconomy(1, 1_000n);

      expect(spent).toBe(100n);
      expect(player.gold()).toBe(0n);
      expect(player.debt()).toBeGreaterThan(0n);
    });

    test("accrues no debt while at peace", () => {
      player.updateWarEconomy(0, 1_000n);

      expect(player.debt()).toBe(0n);
    });
  });

  describe("debt service", () => {
    test("diverts half of the income to outstanding debt", () => {
      player.addDebt(1_000n);

      const net = player.serviceDebt(100n);

      expect(net).toBe(50n);
      expect(player.debt()).toBe(950n);
    });

    test("repays at most the outstanding debt", () => {
      player.addDebt(20n);

      const net = player.serviceDebt(100n);

      expect(net).toBe(80n);
      expect(player.debt()).toBe(0n);
    });

    test("passes income through untouched when debt-free", () => {
      expect(player.serviceDebt(100n)).toBe(100n);
    });
  });

  describe("fleet upkeep", () => {
    const sea = { x: 12, y: 8 };

    test("charges the treasury for every hull it can afford", () => {
      const upkeep = game.config().unitUpkeep(UnitType.Warship);
      expect(upkeep).toBeGreaterThan(0n);
      const tile = game.ref(sea.x, sea.y);
      player.buildUnit(UnitType.Warship, tile, { patrolTile: tile });
      player.buildUnit(UnitType.Warship, tile, { patrolTile: tile });
      // Fund the treasury after paying build costs so only upkeep drains it.
      player.addGold(upkeep * 10n);

      const charged = player.chargeFleetUpkeep();

      expect(charged).toBe(upkeep * 2n);
      expect(player.gold()).toBe(upkeep * 8n);
      expect(player.debt()).toBe(0n);
    });

    test("turns unaffordable upkeep into debt", () => {
      const tile = game.ref(sea.x, sea.y);
      player.buildUnit(UnitType.Submarine, tile, {});

      const charged = player.chargeFleetUpkeep();

      expect(charged).toBe(game.config().unitUpkeep(UnitType.Submarine));
      expect(player.gold()).toBe(0n);
      expect(player.debt()).toBe(charged);
    });

    test("charges nothing without a fleet", () => {
      player.addGold(1_000n);

      expect(player.chargeFleetUpkeep()).toBe(0n);
      expect(player.gold()).toBe(1_000n);
    });
  });

  describe("interest", () => {
    test("accrues configured interest on outstanding debt", () => {
      player.addDebt(10_000n);

      player.accrueDebtInterest();

      const rate = game.config().debtInterestRateBps();
      expect(player.debt()).toBe(10_000n + (10_000n * rate) / 10_000n);
    });

    test("accrues nothing when debt-free", () => {
      player.accrueDebtInterest();

      expect(player.debt()).toBe(0n);
    });
  });
});

import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { setup } from "../util/Setup";
import { UseRealAttackLogic } from "../util/TestConfig";

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

  describe("bankruptcy", () => {
    test("computes GDP as the treasury plus asset book value", () => {
      const tile = game.ref(12, 8);
      player.buildUnit(UnitType.Warship, tile, { patrolTile: tile });
      player.addGold(1_000n);

      expect(player.gdp()).toBe(
        1_000n + game.config().unitBookValue(UnitType.Warship),
      );
    });

    test("declares bankruptcy when debt exceeds GDP", () => {
      player.addGold(1_000n);
      expect(player.isBankrupt()).toBe(false);

      player.addDebt(player.gdp() + 1n);
      player.updateBankruptcy();

      expect(player.isBankrupt()).toBe(true);
    });

    test("stays solvent while debt is covered by GDP", () => {
      player.addGold(1_000n);
      player.addDebt(500n);

      player.updateBankruptcy();

      expect(player.isBankrupt()).toBe(false);
    });

    test("seizes all income while bankrupt", () => {
      player.addDebt(1_000n);
      player.updateBankruptcy();
      expect(player.isBankrupt()).toBe(true);

      const net = player.serviceDebt(100n);

      expect(net).toBe(0n);
      expect(player.debt()).toBe(900n);
    });

    test("recovers solvency once the debt is fully repaid", () => {
      player.addDebt(100n);
      player.updateBankruptcy();
      expect(player.isBankrupt()).toBe(true);

      player.serviceDebt(200n);
      player.updateBankruptcy();

      expect(player.isBankrupt()).toBe(false);
    });

    test("bankrupt defenders are cheaper and faster to invade", async () => {
      const invaded = await setup(
        "half_land_half_ocean",
        {},
        [
          new PlayerInfo("attacker", PlayerType.Human, null, "attacker_id"),
          new PlayerInfo("defender", PlayerType.Human, null, "defender_id"),
        ],
        undefined,
        UseRealAttackLogic, // don't use TestConfig's mock attackLogic
      );
      const attacker = invaded.player("attacker_id");
      const defender = invaded.player("defender_id");
      const tile = invaded.ref(3, 8);
      defender.conquer(tile);
      defender.addTroops(10_000);
      attacker.addTroops(10_000);

      const solvent = invaded
        .config()
        .attackLogic(invaded, 1_000, attacker, defender, tile);
      defender.addDebt(defender.gdp() + 1n);
      defender.updateBankruptcy();
      const bankrupt = invaded
        .config()
        .attackLogic(invaded, 1_000, attacker, defender, tile);

      expect(bankrupt.attackerTroopLoss).toBeLessThan(
        solvent.attackerTroopLoss,
      );
      // Lower per-tile budget cost means the invasion advances faster.
      expect(bankrupt.tilesPerTickUsed).toBeLessThan(solvent.tilesPerTickUsed);
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

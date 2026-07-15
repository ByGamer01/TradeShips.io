import { Game, Player, UnitType } from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import { ConstructionExecution } from "../ConstructionExecution";
import { SpecializePortExecution } from "../SpecializePortExecution";
import { TariffExecution } from "../TariffExecution";
import { UpgradeStructureExecution } from "../UpgradeStructureExecution";

/** Builds the nation's diplomatic infrastructure and uses it against rich rivals. */
export class NationEconomicBehavior {
  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  manageEconomy(): boolean {
    if (this.specializeTradePort()) return true;
    if (this.player.isBankrupt() || this.player.debt() > 0n) return false;
    if (this.upgradeTradePort()) return true;
    if (this.game.config().isUnitDisabled(UnitType.Congress)) return false;

    const targets = this.tariffTargets();
    if (targets.length === 0) return false;
    const congresses = this.player.units(UnitType.Congress);
    const activeCongress = congresses.some(
      (unit) => unit.isActive() && !unit.isUnderConstruction(),
    );
    if (!activeCongress) {
      if (congresses.length > 0) return false;
      return this.buildCongress();
    }

    const cost = this.game.config().tariffCost();
    if (this.player.gold() < cost * 2n) return false;
    this.game.addExecution(new TariffExecution(this.player, targets[0].id()));
    return true;
  }

  /**
   * Nations turn every mature port into a trade hub. Specialization is free,
   * so it remains useful even while the nation is recovering from debt.
   */
  private specializeTradePort(): boolean {
    const minLevel = this.game.config().portSpecializationMinLevel();
    const port = this.tradePortsNeedingSpecialization().find(
      (candidate) => candidate.level() >= minLevel,
    );
    if (port === undefined) return false;

    this.game.addExecution(
      new SpecializePortExecution(this.player, port.id(), "trade"),
    );
    return true;
  }

  /** Upgrade one commercial port at a time until it can become a trade hub. */
  private upgradeTradePort(): boolean {
    const minLevel = this.game.config().portSpecializationMinLevel();
    const port = this.tradePortsNeedingSpecialization().find(
      (candidate) =>
        candidate.level() < minLevel && this.player.canUpgradeUnit(candidate),
    );
    if (port === undefined) return false;

    this.game.addExecution(
      new UpgradeStructureExecution(this.player, port.id()),
    );
    return true;
  }

  private tradePortsNeedingSpecialization() {
    return this.player
      .units(UnitType.Port)
      .filter(
        (port) =>
          port.isActive() &&
          !port.isUnderConstruction() &&
          port.portSpecialization() === undefined,
      )
      .sort((a, b) => a.id() - b.id());
  }

  private tariffTargets(): Player[] {
    return this.game
      .players()
      .filter(
        (other) =>
          other !== this.player &&
          other.isAlive() &&
          !this.player.isFriendly(other) &&
          this.player.canTrade(other) &&
          !this.player.hasTariffAgainst(other),
      )
      .sort((a, b) =>
        b.gold() > a.gold()
          ? 1
          : b.gold() < a.gold()
            ? -1
            : a.smallID() - b.smallID(),
      );
  }

  private buildCongress(): boolean {
    const cost = this.game
      .unitInfo(UnitType.Congress)
      .cost(this.game, this.player);
    if (this.player.gold() < cost * 2n) return false;
    const tiles = Array.from(this.player.tiles());
    for (let attempt = 0; attempt < Math.min(100, tiles.length); attempt++) {
      const tile = this.random.randElement(tiles);
      if (this.player.canBuild(UnitType.Congress, tile) === false) continue;
      this.game.addExecution(
        new ConstructionExecution(this.player, UnitType.Congress, tile),
      );
      return true;
    }
    return false;
  }
}

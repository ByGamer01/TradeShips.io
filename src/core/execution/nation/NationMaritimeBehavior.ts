import { Difficulty, Game, Player, UnitType } from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import { ConstructionExecution } from "../ConstructionExecution";
import {
  aggregateNavalPower,
  CAPTURE_POWER_CAP,
  controllerFor,
  controllerKey,
  NAVAL_CAPTURE_POWER,
} from "../utils/MaritimeCapture";
import { nationDifficulty } from "../utils/NationDifficulty";

// Same fleet ceiling NationWarshipBehavior enforces for retaliation.
const MAX_TOTAL_WARSHIPS = 10;
// Only spend on a new hull when the treasury holds a comfortable multiple.
const BUILD_GOLD_MULTIPLE = 2n;
// Enough hulls to reach CAPTURE_POWER_CAP and stall any rival capture;
// past this, extra patrol ships buy nothing on the objective clock.
const WARSHIP_POWER = NAVAL_CAPTURE_POWER.get(UnitType.Warship) ?? 1;
const MAX_DETACHMENT = Math.ceil(CAPTURE_POWER_CAP / WARSHIP_POWER);

/**
 * Makes nations contest the maritime objective (the win condition) instead of
 * playing pure territorial conquest. Each cycle the nation keeps a
 * difficulty-sized detachment of warships patrolling inside the zone:
 * existing warships are retasked first (one per cycle), and a new one is
 * built aimed at the zone only when the whole fleet is already committed.
 */
export class NationMaritimeBehavior {
  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  /**
   * Base detachment by difficulty, escalated to outmatch the strongest
   * rival fleet inside the zone, and never past the capture-stall size.
   */
  private desiredDetachment(
    zone: NonNullable<ReturnType<Game["maritimeZone"]>>,
  ): number {
    const base = nationDifficulty(this.game) === Difficulty.Impossible ? 3 : 2;
    const selfKey = controllerKey(controllerFor(this.game, this.player));
    const rival = aggregateNavalPower(this.game, (unit) =>
      zone.contains(unit.tile()),
    ).find((entry) => controllerKey(entry.controller) !== selfKey);
    if (rival === undefined) return base;
    const needed =
      Math.ceil(Math.min(rival.power, CAPTURE_POWER_CAP) / WARSHIP_POWER) + 1;
    return Math.max(base, Math.min(needed, MAX_DETACHMENT));
  }

  contestObjective(): void {
    const zone = this.game.maritimeZone();
    if (zone === null) return;
    if (this.game.config().isUnitDisabled(UnitType.Warship)) return;
    if (this.player.units(UnitType.Port).length === 0) return;

    const desired = this.desiredDetachment(zone);
    const warships = this.player.units(UnitType.Warship);
    const patrolling = warships.filter((warship) => {
      const patrolTile = warship.warshipState().patrolTile;
      return patrolTile !== undefined && zone.contains(patrolTile);
    });
    if (patrolling.length >= desired) return;

    // Redirect an off-objective warship before spending gold on a new hull.
    const offObjective = warships.find((warship) => {
      const patrolTile = warship.warshipState().patrolTile;
      return patrolTile === undefined || !zone.contains(patrolTile);
    });
    if (offObjective !== undefined) {
      offObjective.updateWarshipState({
        patrolTile: zone.randomPatrolTile(this.random),
      });
      return;
    }

    if (warships.length >= MAX_TOTAL_WARSHIPS) return;
    const cost = this.game
      .unitInfo(UnitType.Warship)
      .cost(this.game, this.player);
    if (this.player.gold() < cost * BUILD_GOLD_MULTIPLE) return;
    const target = zone.randomPatrolTile(this.random);
    if (this.player.canBuild(UnitType.Warship, target) === false) return;
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.Warship, target),
    );
  }
}

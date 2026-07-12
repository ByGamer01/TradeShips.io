import { Execution, Game, Player, Team, Unit } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import {
  GameUpdateType,
  MaritimeObjectiveStatus,
  MaritimeObjectiveUpdate,
} from "../game/GameUpdates";
import { findOpenWaterAnchor } from "../game/TradeLaneFinder";
import {
  aggregateNavalPower,
  CaptureState,
  NavalPowerEntry,
  newCaptureState,
  stepCapture,
  wireController,
} from "./utils/MaritimeCapture";

export type { MaritimeObjectiveStatus };

export interface MaritimeObjectiveSnapshot {
  center: TileRef;
  radius: number;
  controller: Player | Team | null;
  leader: Player | Team | null;
  controlPercent: number;
  status: MaritimeObjectiveStatus;
  navalPower: Array<{ controller: Player | Team; power: number }>;
}

const OBJECTIVE_RADIUS_RATIO = 0.09;
const MIN_OBJECTIVE_RADIUS = 12;
const MAX_OBJECTIVE_RADIUS = 32;
const WATER_SEARCH_RADIUS = 48;

function objectiveRadius(mapWidth: number, mapHeight: number): number {
  const radius = Math.round(
    Math.min(mapWidth, mapHeight) * OBJECTIVE_RADIUS_RATIO,
  );
  return Math.max(MIN_OBJECTIVE_RADIUS, Math.min(MAX_OBJECTIVE_RADIUS, radius));
}

export class MaritimeObjectiveExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private center: TileRef = 0;
  private radius = MIN_OBJECTIVE_RADIUS;
  private state: CaptureState = newCaptureState();
  private navalPower: NavalPowerEntry[] = [];

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    // Anchor in the open sea of the main water body; the nearest-water
    // fallback can land in a tiny inland bay when the map center is land.
    this.center =
      findOpenWaterAnchor(mg, mg.miniMap()) ??
      this.nearestWaterTile(
        mg.ref(Math.round(mg.width() / 2), Math.round(mg.height() / 2)),
      );
    this.radius = objectiveRadius(mg.width(), mg.height());

    mg.setMaritimeZone({
      center: () => this.center,
      contains: (tile) =>
        mg.euclideanDistSquared(tile, this.center) <= this.radius ** 2,
      randomPatrolTile: (rand) => this.randomPatrolTile(rand),
    });
  }

  /** Deterministic water tile inside the objective circle (center fallback). */
  private randomPatrolTile(rand: PseudoRandom): TileRef {
    if (this.mg === null) return this.center;
    const centerX = this.mg.x(this.center);
    const centerY = this.mg.y(this.center);
    for (let attempts = 0; attempts < 50; attempts++) {
      const x = rand.nextInt(centerX - this.radius, centerX + this.radius + 1);
      const y = rand.nextInt(centerY - this.radius, centerY + this.radius + 1);
      if (!this.mg.isValidCoord(x, y)) continue;
      const tile = this.mg.ref(x, y);
      if (!this.mg.isWater(tile)) continue;
      if (this.mg.euclideanDistSquared(tile, this.center) > this.radius ** 2) {
        continue;
      }
      return tile;
    }
    return this.center;
  }

  tick(_ticks: number): void {
    if (!this.active || this.mg === null || this.mg.getWinner() !== null) {
      return;
    }

    this.navalPower = aggregateNavalPower(this.mg, (unit) =>
      this.isInsideObjective(unit),
    );
    stepCapture(this.state, this.navalPower);

    this.emitUpdate();

    if (this.state.status === "controlled" && this.state.controller !== null) {
      this.mg.setWinner(this.state.controller, this.mg.stats().stats());
      this.active = false;
    }
  }

  private emitUpdate(): void {
    if (this.mg === null) return;
    const controller = wireController(this.state.controller);
    const leader = wireController(this.state.leader);
    const update: MaritimeObjectiveUpdate = {
      type: GameUpdateType.MaritimeObjective,
      shape: "circle",
      center: this.center,
      radius: this.radius,
      controllerSmallID: controller.smallID,
      controllerTeam: controller.team,
      leaderSmallID: leader.smallID,
      leaderTeam: leader.team,
      controlPercent: this.state.controlPercent,
      status: this.state.status,
      navalPower: this.navalPower.map((entry) => {
        const wire = wireController(entry.controller);
        return { smallID: wire.smallID, team: wire.team, power: entry.power };
      }),
    };
    this.mg.addUpdate(update);
  }

  snapshot(): MaritimeObjectiveSnapshot {
    return {
      center: this.center,
      radius: this.radius,
      controller: this.state.controller,
      leader: this.state.leader,
      controlPercent: this.state.controlPercent,
      status: this.state.status,
      navalPower: this.navalPower,
    };
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private isInsideObjective(unit: Unit): boolean {
    if (this.mg === null) return false;
    return (
      this.mg.euclideanDistSquared(unit.tile(), this.center) <= this.radius ** 2
    );
  }

  private nearestWaterTile(tile: TileRef): TileRef {
    if (this.mg === null) return tile;
    if (this.mg.isWater(tile)) return tile;

    const centerX = this.mg.x(tile);
    const centerY = this.mg.y(tile);
    for (let radius = 1; radius <= WATER_SEARCH_RADIUS; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
          const x = centerX + dx;
          const y = centerY + dy;
          if (!this.mg.isValidCoord(x, y)) continue;
          const candidate = this.mg.ref(x, y);
          if (this.mg.isWater(candidate)) return candidate;
        }
      }
    }

    return tile;
  }
}

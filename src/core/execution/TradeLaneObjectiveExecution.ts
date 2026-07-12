import { Execution, Game, Player, Team, Unit } from "../game/Game";
import { TileRef } from "../game/GameMap";
import {
  GameUpdateType,
  MaritimeObjectiveStatus,
  MaritimeObjectiveUpdate,
} from "../game/GameUpdates";
import { findTradeLane, TradeLane } from "../game/TradeLaneFinder";
import { MaritimeObjectiveExecution } from "./MaritimeObjectiveExecution";
import {
  aggregateNavalPower,
  CaptureState,
  NavalPowerEntry,
  newCaptureState,
  stepCapture,
  wireController,
} from "./utils/MaritimeCapture";

export interface TradeLaneObjectiveSnapshot {
  path: TileRef[];
  halfWidth: number;
  controller: Player | Team | null;
  leader: Player | Team | null;
  controlPercent: number;
  status: MaritimeObjectiveStatus;
  navalPower: Array<{ controller: Player | Team; power: number }>;
  usedFallback: boolean;
}

// Every Nth spine tile goes on the wire; the full path only feeds the mask.
const WIRE_PATH_STRIDE = 4;

/**
 * FFA-mode maritime objective: a wide corridor of open water ("central trade
 * lane") replacing the Team-mode circle. Same sustained-capture mechanic,
 * applied to naval power inside the corridor mask. On maps whose largest
 * water body cannot host a corridor it degrades to the circular objective.
 */
export class TradeLaneObjectiveExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private lane: TradeLane | null = null;
  private fallback: MaritimeObjectiveExecution | null = null;
  private state: CaptureState = newCaptureState();
  private navalPower: NavalPowerEntry[] = [];
  private wirePath: TileRef[] = [];
  private center: TileRef = 0;
  private pathSent = false;

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.lane = findTradeLane(mg, mg.miniMap());
    if (this.lane === null) {
      this.fallback = new MaritimeObjectiveExecution();
      this.fallback.init(mg, ticks);
      return;
    }

    const path = this.lane.path;
    this.center = path[(path.length / 2) | 0];
    this.wirePath = path.filter(
      (_, i) => i % WIRE_PATH_STRIDE === 0 || i === path.length - 1,
    );

    const lane = this.lane;
    mg.setMaritimeZone({
      center: () => this.center,
      contains: (tile) => lane.membership[tile] === 1,
      // Spine tiles are open water by construction.
      randomPatrolTile: (rand) => rand.randElement(lane.path),
    });
  }

  tick(ticks: number): void {
    if (this.fallback !== null) {
      this.fallback.tick(ticks);
      return;
    }
    if (!this.active || this.mg === null || this.mg.getWinner() !== null) {
      return;
    }

    this.navalPower = aggregateNavalPower(this.mg, (unit) =>
      this.isInsideLane(unit),
    );
    stepCapture(this.state, this.navalPower);

    this.emitUpdate();

    if (this.state.status === "controlled" && this.state.controller !== null) {
      this.mg.setWinner(this.state.controller, this.mg.stats().stats());
      this.active = false;
    }
  }

  private isInsideLane(unit: Unit): boolean {
    return this.lane !== null && this.lane.membership[unit.tile()] === 1;
  }

  private emitUpdate(): void {
    if (this.mg === null || this.lane === null) return;
    const controller = wireController(this.state.controller);
    const leader = wireController(this.state.leader);
    const update: MaritimeObjectiveUpdate = {
      type: GameUpdateType.MaritimeObjective,
      shape: "lane",
      center: this.center,
      radius: this.lane.halfWidth,
      laneHalfWidth: this.lane.halfWidth,
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
    if (!this.pathSent) {
      update.path = this.wirePath;
      this.pathSent = true;
    }
    this.mg.addUpdate(update);
  }

  snapshot(): TradeLaneObjectiveSnapshot {
    return {
      path: this.lane?.path ?? [],
      halfWidth: this.lane?.halfWidth ?? 0,
      controller: this.state.controller,
      leader: this.state.leader,
      controlPercent: this.state.controlPercent,
      status: this.state.status,
      navalPower: this.navalPower,
      usedFallback: this.fallback !== null,
    };
  }

  isActive(): boolean {
    return this.fallback !== null ? this.fallback.isActive() : this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

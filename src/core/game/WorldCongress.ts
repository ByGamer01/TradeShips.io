import { Game, Player, PlayerType, Tick, UnitType } from "./Game";

export const CONGRESS_FIRST_SESSION_TURN = 10 * 60 * 10;
export const CONGRESS_SESSION_INTERVAL_TURNS = 10 * 60 * 10;
export const CONGRESS_VOTE_DURATION_MS = 60_000;
export const CONGRESS_RESOLUTION_DURATION_TICKS = 3 * 60 * 10;

export type CongressResolutionType =
  | "condemn_player"
  | "embargo_player"
  | "nuclear_non_proliferation"
  | "infrastructure_subsidy"
  | "infrastructure_tax"
  | "open_seas"
  | "international_development_fund";

export type CongressInfrastructureType =
  | UnitType.Port
  | UnitType.City
  | UnitType.Factory;

export interface CongressProposal {
  type: CongressResolutionType;
  targetSmallID?: number;
  infrastructureType?: CongressInfrastructureType;
}

export interface ActiveCongressResolution extends CongressProposal {
  session: number;
  expiresAt?: Tick;
}

export interface CongressState {
  session: number;
  proposals: CongressProposal[];
  activeResolutions: ActiveCongressResolution[];
  lastTargetSmallID?: number;
}

const states = new WeakMap<Game, CongressState>();

export function getCongressState(game: Game): CongressState {
  let state = states.get(game);
  if (state === undefined) {
    state = { session: 0, proposals: [], activeResolutions: [] };
    states.set(game, state);
  }
  state.activeResolutions = state.activeResolutions.filter(
    (resolution) =>
      resolution.expiresAt === undefined || game.ticks() < resolution.expiresAt,
  );
  return state;
}

export function congressProposalTemplates(
  session: number,
): Omit<CongressProposal, "targetSmallID">[] {
  switch ((session - 1) % 3) {
    case 0:
      return [
        { type: "international_development_fund" },
        {
          type: "infrastructure_subsidy",
          infrastructureType: UnitType.Port,
        },
        { type: "nuclear_non_proliferation" },
      ];
    case 1:
      return [
        { type: "embargo_player" },
        {
          type: "infrastructure_tax",
          infrastructureType: UnitType.Factory,
        },
        { type: "open_seas" },
      ];
    default:
      return [
        { type: "condemn_player" },
        {
          type: "infrastructure_subsidy",
          infrastructureType: UnitType.City,
        },
        { type: "nuclear_non_proliferation" },
      ];
  }
}

export function isTargetedCongressResolution(
  type: CongressResolutionType,
): boolean {
  return type === "condemn_player" || type === "embargo_player";
}

export function selectCongressWinner(
  session: number,
  voteCounts: readonly number[],
  eligibleVoters: number,
): number {
  const ranked = voteCounts
    .map((_, index) => index)
    .sort((a, b) => voteCounts[b] - voteCounts[a] || a - b);
  const templates = congressProposalTemplates(session);
  const winner = ranked[0] ?? 0;
  const threshold = Math.ceil(eligibleVoters / 2);
  if (
    !isTargetedCongressResolution(templates[winner].type) ||
    voteCounts[winner] >= threshold
  ) {
    return winner;
  }
  return (
    ranked.find(
      (index) => !isTargetedCongressResolution(templates[index].type),
    ) ?? winner
  );
}

export function createCongressProposals(
  game: Game,
  session: number,
): CongressProposal[] {
  const state = getCongressState(game);
  const candidates = game
    .players()
    .filter(
      (player) =>
        player.type() === PlayerType.Human &&
        player.isAlive() &&
        !player.isDisconnected(),
    )
    .sort(
      (a, b) =>
        b.numTilesOwned() - a.numTilesOwned() || a.smallID() - b.smallID(),
    );
  const target =
    candidates.find((p) => p.smallID() !== state.lastTargetSmallID) ??
    candidates[0];

  const proposals = congressProposalTemplates(session).map((proposal) =>
    isTargetedCongressResolution(proposal.type) && target !== undefined
      ? { ...proposal, targetSmallID: target.smallID() }
      : proposal,
  );
  if (
    target !== undefined &&
    proposals.some((proposal) => isTargetedCongressResolution(proposal.type))
  ) {
    state.lastTargetSmallID = target.smallID();
  }
  return proposals;
}

export function activateCongressResolution(
  game: Game,
  resolution: ActiveCongressResolution,
): void {
  const state = getCongressState(game);
  state.activeResolutions.push(resolution);
  if (resolution.targetSmallID !== undefined) {
    state.lastTargetSmallID = resolution.targetSmallID;
  }
}

export function isCongressResolutionActive(
  game: Game,
  type: CongressResolutionType,
): boolean {
  return getCongressState(game).activeResolutions.some(
    (resolution) => resolution.type === type,
  );
}

export function infrastructureCostMultiplier(
  game: Game,
  unitType: UnitType,
): number {
  let multiplier = 1;
  for (const resolution of getCongressState(game).activeResolutions) {
    if (resolution.infrastructureType !== unitType) continue;
    if (resolution.type === "infrastructure_subsidy") multiplier *= 0.5;
    if (resolution.type === "infrastructure_tax") multiplier *= 1.5;
  }
  return multiplier;
}

export function isNuclearUnit(type: UnitType): boolean {
  return (
    type === UnitType.AtomBomb ||
    type === UnitType.HydrogenBomb ||
    type === UnitType.MIRV
  );
}

export function activeHumanPlayers(game: Game): Player[] {
  return game
    .players()
    .filter(
      (player) =>
        player.type() === PlayerType.Human &&
        player.isAlive() &&
        !player.isDisconnected(),
    );
}

import { z } from "zod";

/**
 * Client side of the squad queue: create/join a party, poll its state, and
 * surface leader lobby picks so the whole party lands in the same public game.
 *
 * Events dispatched on `window`:
 * - "party-updated"  detail: PartyInfo | null (null after leaving/expiry)
 * - "party-target"   detail: { gameID: string } (non-leaders only)
 */

const PartyInfoSchema = z.object({
  partyId: z.string(),
  members: z.array(z.object({ name: z.string(), isLeader: z.boolean() })),
  targetGameID: z.string().nullable(),
  targetVersion: z.number(),
  youAreLeader: z.boolean().optional(),
});

export type PartyInfo = z.infer<typeof PartyInfoSchema>;

const StoredPartyStateSchema = z.object({
  partyId: z.string(),
  memberId: z.string(),
  isLeader: z.boolean(),
  consumedTargetVersion: z.number(),
});

type StoredPartyState = z.infer<typeof StoredPartyStateSchema>;

const STORAGE_KEY = "partyState";
const POLL_INTERVAL_MS = 2500;

class PartyClient {
  private state: StoredPartyState | null = null;
  private lastInfo: PartyInfo | null = null;
  private pollTimer: number | null = null;
  private polling = false;

  constructor() {
    this.state = this.readStoredState();
  }

  isInParty(): boolean {
    return this.state !== null;
  }

  isLeader(): boolean {
    return this.state?.isLeader ?? false;
  }

  partyId(): string | null {
    return this.state?.partyId ?? null;
  }

  partyInfo(): PartyInfo | null {
    return this.lastInfo;
  }

  inviteUrl(): string | null {
    if (this.state === null) return null;
    return `${window.location.origin}/?ref=party#party=${this.state.partyId}`;
  }

  /** Resume a stored party after a page load; starts polling if valid. */
  resume(): void {
    if (this.state !== null) {
      this.startPolling();
    }
  }

  async create(name: string): Promise<boolean> {
    const response = await this.request("/api/party", { name });
    if (response === null) return false;
    const parsed = z
      .object({ partyId: z.string(), memberId: z.string() })
      .safeParse(response);
    if (!parsed.success) return false;
    this.setState({
      partyId: parsed.data.partyId,
      memberId: parsed.data.memberId,
      isLeader: true,
      consumedTargetVersion: 0,
    });
    this.startPolling();
    return true;
  }

  async join(partyId: string, name: string): Promise<boolean> {
    // Joining while already in a party moves you to the new one.
    await this.leave();
    const response = await this.request(
      `/api/party/${encodeURIComponent(partyId)}/join`,
      { name },
    );
    if (response === null) return false;
    const parsed = z.object({ memberId: z.string() }).safeParse(response);
    if (!parsed.success) return false;
    this.setState({
      partyId,
      memberId: parsed.data.memberId,
      isLeader: false,
      // Ignore any lobby the leader picked before we arrived.
      consumedTargetVersion: Number.MAX_SAFE_INTEGER,
    });
    this.startPolling();
    // First poll (below) resets consumedTargetVersion to the current value.
    return true;
  }

  async leave(): Promise<void> {
    const state = this.state;
    if (state === null) return;
    this.clearState();
    await this.request(
      `/api/party/${encodeURIComponent(state.partyId)}/leave`,
      { memberId: state.memberId },
    );
  }

  /** Leader entered a public lobby: point the party at it. */
  async setTarget(gameID: string): Promise<void> {
    const state = this.state;
    if (state === null || !state.isLeader) return;
    await this.request(
      `/api/party/${encodeURIComponent(state.partyId)}/target`,
      { memberId: state.memberId, gameID },
    );
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    void this.pollOnce();
    this.pollTimer = window.setInterval(
      () => void this.pollOnce(),
      POLL_INTERVAL_MS,
    );
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    const state = this.state;
    if (state === null || this.polling) return;
    this.polling = true;
    try {
      const response = await fetch(
        `/api/party/${encodeURIComponent(state.partyId)}?memberId=${encodeURIComponent(state.memberId)}`,
        { headers: { "Content-Type": "application/json" } },
      );
      if (response.status === 404) {
        // Party expired or dissolved.
        this.clearState();
        return;
      }
      if (!response.ok) return;
      const parsed = PartyInfoSchema.safeParse(await response.json());
      if (!parsed.success) return;
      this.handlePartyInfo(parsed.data);
    } catch {
      // Transient network failure — keep polling.
    } finally {
      this.polling = false;
    }
  }

  private handlePartyInfo(info: PartyInfo): void {
    let state = this.state;
    if (state === null) return;

    // Pick up leader promotion (the previous leader left).
    if (info.youAreLeader !== undefined && info.youAreLeader !== state.isLeader) {
      state = { ...state, isLeader: info.youAreLeader };
      this.setState(state);
    }

    if (state.consumedTargetVersion === Number.MAX_SAFE_INTEGER) {
      // First poll after joining: baseline the version, don't chase old picks.
      this.setState({ ...state, consumedTargetVersion: info.targetVersion });
    } else if (
      !state.isLeader &&
      info.targetGameID !== null &&
      info.targetVersion > state.consumedTargetVersion
    ) {
      this.setState({ ...state, consumedTargetVersion: info.targetVersion });
      window.dispatchEvent(
        new CustomEvent("party-target", {
          detail: { gameID: info.targetGameID },
        }),
      );
    }

    this.lastInfo = info;
    window.dispatchEvent(new CustomEvent("party-updated", { detail: info }));
  }

  private setState(state: StoredPartyState): void {
    this.state = state;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Session storage unavailable — party won't survive reloads.
    }
  }

  private clearState(): void {
    this.state = null;
    this.lastInfo = null;
    this.stopPolling();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("party-updated", { detail: null }));
  }

  private readStoredState(): StoredPartyState | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      const parsed = StoredPartyStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async request(
    url: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}

export const partyClient = new PartyClient();

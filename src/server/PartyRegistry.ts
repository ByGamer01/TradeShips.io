import crypto from "crypto";

/**
 * In-memory registry for squad-queue parties, hosted on the master process.
 *
 * A party is a lightweight rendezvous: friends join via an invite link, and
 * when the leader enters a public lobby the party members follow it through
 * polling. Party membership also travels in the game join message so the
 * game server can group partymates as friends (same team, adjacent spawns).
 */

export const PARTY_ID_REGEX = /^[a-z0-9]{8}$/;

export const MAX_PARTY_MEMBERS = 8;
const MAX_PARTIES = 10_000;
const PARTY_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours without activity
const MAX_NAME_LENGTH = 24;

interface PartyMember {
  memberId: string;
  name: string;
  joinedAt: number;
}

interface Party {
  id: string;
  leaderMemberId: string;
  members: Map<string, PartyMember>;
  targetGameID: string | null;
  targetVersion: number;
  updatedAt: number;
}

/** Wire-facing view; other members' secret ids are never exposed. */
export interface PartyInfo {
  partyId: string;
  members: { name: string; isLeader: boolean }[];
  targetGameID: string | null;
  targetVersion: number;
}

export type PartyJoinResult =
  | { status: "ok"; memberId: string }
  | { status: "not_found" }
  | { status: "full" };

export class PartyRegistry {
  private parties = new Map<string, Party>();

  constructor(private now: () => number = Date.now) {}

  create(name: string): { partyId: string; memberId: string } | null {
    if (this.parties.size >= MAX_PARTIES) {
      this.sweep();
      if (this.parties.size >= MAX_PARTIES) {
        return null;
      }
    }
    const partyId = this.newPartyId();
    const member = this.newMember(name);
    const party: Party = {
      id: partyId,
      leaderMemberId: member.memberId,
      members: new Map([[member.memberId, member]]),
      targetGameID: null,
      targetVersion: 0,
      updatedAt: this.now(),
    };
    this.parties.set(partyId, party);
    return { partyId, memberId: member.memberId };
  }

  join(partyId: string, name: string): PartyJoinResult {
    const party = this.getLive(partyId);
    if (party === null) {
      return { status: "not_found" };
    }
    if (party.members.size >= MAX_PARTY_MEMBERS) {
      return { status: "full" };
    }
    const member = this.newMember(name);
    party.members.set(member.memberId, member);
    party.updatedAt = this.now();
    return { status: "ok", memberId: member.memberId };
  }

  leave(partyId: string, memberId: string): void {
    const party = this.getLive(partyId);
    if (party === null || !party.members.has(memberId)) {
      return;
    }
    party.members.delete(memberId);
    party.updatedAt = this.now();
    if (party.members.size === 0) {
      this.parties.delete(partyId);
      return;
    }
    if (party.leaderMemberId === memberId) {
      // Promote the longest-standing member so the party survives.
      const oldest = [...party.members.values()].sort(
        (a, b) => a.joinedAt - b.joinedAt,
      )[0];
      party.leaderMemberId = oldest.memberId;
    }
  }

  /** Leader-only: point the party at a public lobby to follow. */
  setTarget(partyId: string, memberId: string, gameID: string): boolean {
    const party = this.getLive(partyId);
    if (party === null || party.leaderMemberId !== memberId) {
      return false;
    }
    party.targetGameID = gameID;
    party.targetVersion++;
    party.updatedAt = this.now();
    return true;
  }

  /** Polling read; refreshes the TTL for live parties. */
  get(partyId: string): PartyInfo | null {
    const party = this.getLive(partyId);
    if (party === null) {
      return null;
    }
    party.updatedAt = this.now();
    return {
      partyId: party.id,
      members: [...party.members.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((m) => ({
          name: m.name,
          isLeader: m.memberId === party.leaderMemberId,
        })),
      targetGameID: party.targetGameID,
      targetVersion: party.targetVersion,
    };
  }

  isMember(partyId: string, memberId: string): boolean {
    return this.getLive(partyId)?.members.has(memberId) ?? false;
  }

  isLeader(partyId: string, memberId: string): boolean {
    return this.getLive(partyId)?.leaderMemberId === memberId;
  }

  sweep(): void {
    const cutoff = this.now() - PARTY_TTL_MS;
    for (const [id, party] of this.parties) {
      if (party.updatedAt < cutoff) {
        this.parties.delete(id);
      }
    }
  }

  size(): number {
    return this.parties.size;
  }

  private getLive(partyId: string): Party | null {
    const party = this.parties.get(partyId);
    if (party === undefined) {
      return null;
    }
    if (party.updatedAt < this.now() - PARTY_TTL_MS) {
      this.parties.delete(partyId);
      return null;
    }
    return party;
  }

  private newPartyId(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (;;) {
      const bytes = crypto.randomBytes(8);
      let id = "";
      for (const b of bytes) {
        id += alphabet[b % alphabet.length];
      }
      if (!this.parties.has(id)) {
        return id;
      }
    }
  }

  private newMember(name: string): PartyMember {
    return {
      memberId: crypto.randomBytes(12).toString("hex"),
      name: sanitizeName(name),
      joinedAt: this.now(),
    };
  }
}

export function sanitizeName(name: string): string {
  const cleaned = name.replace(/[\p{C}]/gu, "").trim();
  const capped = [...cleaned].slice(0, MAX_NAME_LENGTH).join("");
  return capped.length > 0 ? capped : "Anon";
}

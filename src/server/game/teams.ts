import type { Room } from "@server/game/types";
import type { TeamId } from "@lib/common/enums";

export type TeamMove = { playerId: string; teamId: TeamId };

type ReassignResult =
  | { ok: true; reassigned: TeamMove[] }
  | {
      ok: false;
      status: number;
      error: { code: "VALIDATION"; message: string };
    };

/**
 * Reassign players to teams.
 * - Validates all playerIds exist (fails fast if any missing).
 * - Deduplicates by playerId (last write wins).
 * - Only records actual changes (no-ops skipped).
 * - Mutates the room (caller must persist via setRoom).
 */
export function reassignPlayers(room: Room, moves: TeamMove[]): ReassignResult {
  // Validate players
  for (const m of moves) {
    if (!room.players[m.playerId]) {
      return {
        ok: false,
        status: 400,
        error: { code: "VALIDATION", message: `Unknown player: ${m.playerId}` },
      };
    }
  }

  // Last write wins per playerId
  const finalMap = new Map<string, TeamId>();
  for (const m of moves) finalMap.set(m.playerId, m.teamId);

  // Build final list preserving last-write order encountered
  const finalMoves: TeamMove[] = [];
  for (const [playerId, teamId] of finalMap.entries()) {
    finalMoves.push({ playerId, teamId });
  }

  // Remove each moved player from both teams, then add to target if changed
  const removedFromA = new Set<string>();
  const removedFromB = new Set<string>();
  const reassigned: TeamMove[] = [];

  for (const { playerId, teamId } of finalMoves) {
    const player = room.players[playerId];
    if (!player) continue;

    if (player.teamId === teamId) {
      // no-op, already there
      continue;
    }

    // Remove from current team lists (idempotent guards)
    if (player.teamId === "A" && !removedFromA.has(playerId)) {
      room.teams.A.players = room.teams.A.players.filter(
        (id) => id !== playerId,
      );
      removedFromA.add(playerId);
    }
    if (player.teamId === "B" && !removedFromB.has(playerId)) {
      room.teams.B.players = room.teams.B.players.filter(
        (id) => id !== playerId,
      );
      removedFromB.add(playerId);
    }

    // Add to target team
    room.teams[teamId].players.push(playerId);
    player.teamId = teamId;

    reassigned.push({ playerId, teamId });
  }

  return { ok: true, reassigned };
}

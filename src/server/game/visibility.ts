import type { Room, Turn, Player } from "@server/game/types";
import { VisibleRoomSnapshot, VisibleTurn } from "@lib/view/visible";
import type { TeamId } from "@lib/common/enums";

/**
 * Main entry: per-viewer visible snapshot of the room.
 * - Uses viewerId to hide/show sensitive elements
 * - Uses nowMs to compute remaining time deterministically
 * - Validates the final payload against VisibleRoomSnapshot
 */
export function makeVisibleSnapshot(
  room: Room,
  viewerId: string,
  nowMs: number,
) {
  const viewer: Player | undefined = room.players[viewerId];

  // Public (non-secret) list of players
  const players = Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    isCreator: p.isCreator,
    connected: p.connected,
  }));

  const payload = {
    code: room.code,
    state: room.state,
    settings: {
      ...room.settings,
      // Always include names to keep client simple/predictable.
      teamNames: room.settings.teamNames ?? { A: "Team A", B: "Team B" },
    },
    players,
    teams: {
      A: {
        id: "A" as const,
        players: room.teams.A.players,
        score: room.teams.A.score,
      },
      B: {
        id: "B" as const,
        players: room.teams.B.players,
        score: room.teams.B.score,
      },
    },
    currentRound: room.currentRound,
    round: makeVisibleRound(room, viewer, nowMs),
    // lastTurnSummary: (optional) fill when you finalize per-turn summaries
  };

  // Validate and return a fully typed wire model.
  return VisibleRoomSnapshot.parse(payload);
}

/**
 * Opposing team helper.
 */
function opposing(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

/**
 * Who can see words on the *active* card?
 * - Poet (clue giver)
 * - Members of the opposing team
 * Teammates of the poet cannot see words.
 */
function canSeeActiveCardWords(
  turn: Turn,
  viewer: Player | undefined,
): boolean {
  if (!viewer) return false;
  return viewer.id === turn.poetId || viewer.teamId === opposing(turn.teamId);
}

/**
 * Build the "round" block of the snapshot if there's a current round.
 */
function makeVisibleRound(
  room: Room,
  viewer: Player | undefined,
  nowMs: number,
) {
  const roundNo = room.currentRound;
  if (!roundNo) return undefined;

  const r = room.rounds[roundNo];
  const activeTurn = r.activeTurnId ? room.turns[r.activeTurnId] : undefined;

  const visibleTurn = activeTurn
    ? makeVisibleTurn(activeTurn, viewer, nowMs)
    : undefined;

  return {
    number: r.number,
    poetOrder: r.poetOrder,
    activeTurn: visibleTurn,
    completedTurns: r.completedTurns.length,
  };
}

/**
 * Build a VisibleTurn from an authoritative Turn.
 * Uses nowMs to compute remainingSeconds deterministically for tests.
 * Important: We *never* include real words in the snapshot—those are sent
 * via audience-filtered WS events (e.g., `turn:card`) to poet/opponents.
 */
function makeVisibleTurn(
  turn: Turn,
  viewer: Player | undefined,
  nowMs: number,
): VisibleTurn {
  const canSeeWords = canSeeActiveCardWords(turn, viewer);

  const partial = {
    id: turn.id,
    roundNumber: turn.roundNumber,
    poetId: turn.poetId,
    teamId: turn.teamId,
    startedAt: turn.startedAt,
    endsAt: turn.endsAt,
    remainingSeconds:
      turn.endsAt != null
        ? Math.max(0, Math.ceil((turn.endsAt - nowMs) / 1000))
        : undefined,
    activeCard: turn.activeCardId
      ? canSeeWords
        ? // We do NOT send real words here—those go via WS only.
          {
            id: turn.activeCardId,
            onePoint: "REDACTED_AT_SEND",
            threePoint: "REDACTED_AT_SEND",
          }
        : { id: turn.activeCardId }
      : undefined,
    outcomesCount: {
      ONE: turn.outcomes.filter((o) => o.outcome === "ONE").length,
      THREE: turn.outcomes.filter((o) => o.outcome === "THREE").length,
      PENALTY: turn.outcomes.filter((o) => o.outcome === "PENALTY").length,
    },
    endedReason: turn.endedReason,
  };

  // Enforce wire-shape correctness and give us a properly typed result.
  return VisibleTurn.parse(partial);
}

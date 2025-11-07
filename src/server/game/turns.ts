import type { Room, Turn } from "@server/game/types";
import type { TeamId } from "@lib/common/enums";
import { getCardWords } from "@server/game/deck";
import { uid } from "@server/util/id";

function opposing(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

function assertCanStartTurn(
  room: Room,
  playerId: string,
):
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: "BAD_STATE" | "NOT_YOUR_TURN";
      message: string;
    } {
  if (room.state !== "IN_ROUND" || !room.currentRound) {
    return {
      ok: false,
      status: 400,
      code: "BAD_STATE",
      message: "Not in a round",
    };
  }
  const round = room.rounds[room.currentRound];
  if (!round) {
    return {
      ok: false,
      status: 400,
      code: "BAD_STATE",
      message: "No active round",
    };
  }
  if (round.activeTurnId) {
    return {
      ok: false,
      status: 400,
      code: "BAD_STATE",
      message: "A turn is already active",
    };
  }

  // Next poet is the first in poetOrder not in completedTurns
  const completed = new Set(round.completedTurns);
  const nextPoetId = round.poetOrder.find((pid) => !completed.has(pid));
  if (!nextPoetId) {
    return {
      ok: false,
      status: 400,
      code: "BAD_STATE",
      message: "Round is already complete",
    };
  }
  if (nextPoetId !== playerId) {
    return {
      ok: false,
      status: 403,
      code: "NOT_YOUR_TURN",
      message: "It is not your turn",
    };
  }
  return { ok: true };
}

function drawNextCardId(room: Room): string | undefined {
  // Simple FIFO draw
  return room.drawPile.shift();
}

export type StartTurnSuccess = {
  ok: true;
  turn: Required<
    Pick<Turn, "id" | "poetId" | "teamId" | "startedAt" | "endsAt">
  >;
  cardForViewer?: { id: string; onePoint: string; threePoint: string };
};
export type StartTurnFailure = {
  ok: false;
  status: number;
  error: {
    code: "ROOM_NOT_FOUND" | "BAD_STATE" | "NOT_YOUR_TURN" | "VALIDATION";
    message: string;
  };
};
export type StartTurnResult = StartTurnSuccess | StartTurnFailure;

/**
 * Starts the next poet's turn (must be the caller).
 * Mutates room: creates Turn, sets round.activeTurnId, sets endsAt, draws a card.
 */
export function startTurn(
  room: Room,
  playerId: string,
  nowMs: number,
): StartTurnResult {
  const gate = assertCanStartTurn(room, playerId);
  if (!gate.ok) {
    return {
      ok: false,
      status: gate.status,
      error: { code: gate.code, message: gate.message },
    };
  }

  const round = room.rounds[room.currentRound!];
  const poet = room.players[playerId];
  if (!poet) {
    return {
      ok: false,
      status: 400,
      error: { code: "VALIDATION", message: "Unknown player" },
    };
  }

  const cardId = drawNextCardId(room);
  if (!cardId) {
    return {
      ok: false,
      status: 400,
      error: { code: "BAD_STATE", message: "No cards available to draw" },
    };
  }

  const seconds = room.settings.turnSeconds ?? 90;
  const startedAt = nowMs;
  const endsAt = nowMs + seconds * 1000;

  const turnId = uid("t_");
  const turn: Turn = {
    id: turnId,
    roundNumber: room.currentRound!,
    poetId: poet.id,
    teamId: poet.teamId,
    startedAt,
    endsAt,
    activeCardId: cardId,
    outcomes: [],
  };

  room.turns[turnId] = turn;
  round.activeTurnId = turnId;

  // Determine whether to include card words for THIS viewer (poet/opponents only)
  const withWords = true; // caller is poet, always include for the HTTP response
  const words = getCardWords(cardId);

  return {
    ok: true,
    turn: {
      id: turnId,
      poetId: poet.id,
      teamId: poet.teamId,
      startedAt,
      endsAt,
    },
    cardForViewer: withWords
      ? { id: words.id, onePoint: words.onePoint, threePoint: words.threePoint }
      : undefined,
  };
}

/**
 * Helper to decide if a viewer should receive words in HTTP response.
 * Use this in the route when the viewer is NOT the poet (edge admin calls, etc.).
 */
export function shouldViewerSeeWords(
  poetTeam: TeamId,
  viewerTeam: TeamId,
  isPoet: boolean,
): boolean {
  return isPoet || viewerTeam === opposing(poetTeam);
}

import type { Room } from "@server/game/types";
import type { Outcome } from "@lib/common/enums";
import { getCardWords } from "@server/game/deck";
import { scoreDeltaForOutcome, sumTurnDelta } from "@server/game/scoring";
import { isRoundComplete } from "@server/game/rounds";

function drawNextCardId(room: Room): string | undefined {
  return room.drawPile.shift();
}

export type NextCardSuccess =
  | {
      ok: true;
      turnId: string;
      scores: Record<"A" | "B", number>;
      lastCardDelta: Record<"A" | "B", number>;
      nextCard: { id: string; onePoint: string; threePoint: string };
      remainingMs: number;
      turnEnded?: undefined;
    }
  | {
      ok: true;
      turnId: string;
      scores: Record<"A" | "B", number>;
      lastCardDelta: Record<"A" | "B", number>;
      turnEnded: {
        teamDelta: Record<"A" | "B", number>;
        wordsPlayed: { cardId: string; outcome: Outcome }[];
        finalScores: Record<"A" | "B", number>;
      };
      nextCard?: undefined;
      remainingMs?: undefined;
    };

export type NextCardFailure = {
  ok: false;
  status: number;
  error: {
    code: "ROOM_NOT_FOUND" | "BAD_STATE" | "NOT_YOUR_TURN" | "VALIDATION";
    message: string;
  };
};

export type NextCardResult = NextCardSuccess | NextCardFailure;

/**
 * Apply outcome for current active card, move it to discard, maybe draw next.
 * Preconditions:
 * - room.state === "IN_ROUND"
 * - round.activeTurnId exists
 * - caller is the poet of the active turn
 * - request.cardId matches the activeCardId
 */
export function scoreCurrentAndMaybeNextCard(
  room: Room,
  callerId: string,
  nowMs: number,
  req: { cardId: string; outcome: Outcome },
): NextCardResult {
  if (room.state !== "IN_ROUND" || !room.currentRound) {
    return {
      ok: false,
      status: 400,
      error: { code: "BAD_STATE", message: "No active round" },
    };
  }
  const round = room.rounds[room.currentRound];
  if (!round?.activeTurnId) {
    return {
      ok: false,
      status: 400,
      error: { code: "BAD_STATE", message: "No active turn" },
    };
  }
  const turn = room.turns[round.activeTurnId];
  if (!turn) {
    return {
      ok: false,
      status: 400,
      error: { code: "BAD_STATE", message: "Turn not found" },
    };
  }
  if (turn.poetId !== callerId) {
    return {
      ok: false,
      status: 403,
      error: {
        code: "NOT_YOUR_TURN",
        message: "Only the poet can score cards",
      },
    };
  }
  if (!turn.activeCardId) {
    return {
      ok: false,
      status: 400,
      error: { code: "BAD_STATE", message: "No active card to score" },
    };
  }
  if (req.cardId !== turn.activeCardId) {
    return {
      ok: false,
      status: 400,
      error: { code: "VALIDATION", message: "Mismatched cardId" },
    };
  }

  // Timer check
  const remainingMs = Math.max(0, (turn.endsAt ?? nowMs) - nowMs);
  const timeUp = remainingMs <= 0;

  // Score current card for the poet's team (or penalty to the other team)
  const lastDelta = scoreDeltaForOutcome(turn.teamId, req.outcome);
  room.teams.A.score += lastDelta.A;
  room.teams.B.score += lastDelta.B;

  // Track in turn outcomes
  turn.outcomes.push({
    cardId: req.cardId,
    outcome: req.outcome,
    timestamp: nowMs,
  });

  // Move card to discard & clear active
  room.discardPile.push(req.cardId);
  turn.activeCardId = undefined;

  // Decide if the turn ends or continues
  const noMoreCards = room.drawPile.length === 0;

  if (timeUp || noMoreCards) {
    turn.endedReason = timeUp ? "TIMER" : "MANUAL";
    // close the turn
    round.completedTurns.push(turn.id);
    round.activeTurnId = undefined;

    // if round finished, move room to BETWEEN_ROUNDS
    if (isRoundComplete(room)) {
      room.state = "BETWEEN_ROUNDS";
    }

    // Aggregate this turn delta
    const teamDelta = sumTurnDelta(turn.outcomes, turn.teamId);
    const finalScores = { A: room.teams.A.score, B: room.teams.B.score };

    return {
      ok: true,
      turnId: turn.id,
      scores: finalScores,
      lastCardDelta: lastDelta,
      turnEnded: {
        teamDelta,
        wordsPlayed: turn.outcomes.map(({ cardId, outcome }) => ({
          cardId,
          outcome,
        })),
        finalScores,
      },
    };
  }

  // Otherwise, draw next card and keep playing
  const nextCardId = drawNextCardId(room);
  if (!nextCardId) {
    // Should not happen because we checked noMoreCards, but guard anyway
    turn.endedReason = "MANUAL";
    round.completedTurns.push(turn.id);
    round.activeTurnId = undefined;
    const teamDelta = sumTurnDelta(turn.outcomes, turn.teamId);
    const finalScores = { A: room.teams.A.score, B: room.teams.B.score };
    if (isRoundComplete(room)) room.state = "BETWEEN_ROUNDS";
    return {
      ok: true,
      turnId: turn.id,
      scores: finalScores,
      lastCardDelta: lastDelta,
      turnEnded: {
        teamDelta,
        wordsPlayed: turn.outcomes.map(({ cardId, outcome }) => ({
          cardId,
          outcome,
        })),
        finalScores,
      },
    };
  }

  // Set new active card
  turn.activeCardId = nextCardId;

  const words = getCardWords(nextCardId); // include words; only poet should call this API
  const updatedScores = { A: room.teams.A.score, B: room.teams.B.score };

  return {
    ok: true,
    turnId: turn.id,
    scores: updatedScores,
    lastCardDelta: lastDelta,
    nextCard: {
      id: words.id,
      onePoint: words.onePoint,
      threePoint: words.threePoint,
    },
    remainingMs,
  };
}

export function forceEndTurn(room: Room) {
  if (room.state !== "IN_ROUND" || !room.currentRound) return undefined;
  const round = room.rounds[room.currentRound];
  if (!round || !round.activeTurnId) return undefined;
  const turn = room.turns[round.activeTurnId];
  if (!turn) return undefined;

  const activeCardId = turn.activeCardId;
  if (activeCardId) {
    room.discardPile.push(activeCardId);
    turn.activeCardId = undefined;
  }

  turn.endedReason = "TIMER";
  round.completedTurns.push(turn.id);
  round.activeTurnId = undefined;

  if (isRoundComplete(room)) {
    room.state = "BETWEEN_ROUNDS";
  }

  const teamDelta = sumTurnDelta(turn.outcomes, turn.teamId);
  const finalScores = { A: room.teams.A.score, B: room.teams.B.score };

  return {
    turnId: turn.id,
    turnEnded: {
      teamDelta,
      wordsPlayed: turn.outcomes.map(({ cardId, outcome }) => ({
        cardId,
        outcome,
      })),
      finalScores,
    },
    lastCardDelta: { A: 0, B: 0 } as Record<"A" | "B", number>,
    poetId: turn.poetId,
    teamId: turn.teamId,
  };
}

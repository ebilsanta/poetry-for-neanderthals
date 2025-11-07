import type { Room } from "@server/game/types";
import { getAllCardIds } from "@server/game/deck";
import { shuffle } from "@/server/util/shuffle";

/**
 * Alternating poet order A,B,A,B,... row-wise.
 * If one team has more players, the extras come last in their original order.
 */
export function buildPoetOrder(room: Room): string[] {
  const a = room.teams.A.players.slice();
  const b = room.teams.B.players.slice();

  const order: string[] = [];
  const maxLen = Math.max(a.length, b.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < a.length) order.push(a[i]);
    if (i < b.length) order.push(b[i]);
  }
  return order;
}

/** Round is complete when the number of completed turns equals the poet order length. */
export function isRoundComplete(room: Room): boolean {
  const n = room.currentRound;
  if (!n) return false;
  const r = room.rounds[n];
  if (!r) return false;
  return r.completedTurns.length >= r.poetOrder.length && !r.activeTurnId;
}

/** Rotate the poet order so the next round starts with a different poet. */
export function rotatePoetOrder(prevOrder: string[]): string[] {
  if (prevOrder.length === 0) return prevOrder;
  const [head, ...rest] = prevOrder;
  return [...rest, head];
}

/**
 * Start the FIRST round.
 * Preconditions:
 *  - room.state === "LOBBY"
 *  - at least one player on each team (enforce per your game rules)
 */
export function startFirstRound(room: Room) {
  if (room.state !== "LOBBY") {
    return {
      ok: false as const,
      status: 400,
      error: {
        code: "BAD_STATE" as const,
        message: "Round can only be started from the lobby",
      },
    };
  }

  // Basic guard: you usually need at least one on each team to play.
  if (room.teams.A.players.length === 0 || room.teams.B.players.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error: {
        code: "VALIDATION" as const,
        message: "Both teams must have at least one player",
      },
    };
  }

  const allCardIds = getAllCardIds();
  room.drawPile = shuffle(allCardIds);
  room.discardPile = [];

  const number = 1;
  const poetOrder = buildPoetOrder(room);

  room.rounds[number] = {
    number,
    poetOrder,
    completedTurns: [],
    activeTurnId: undefined, // starts when first poet clicks "Start Turn"
  };
  room.currentRound = number;
  room.state = "IN_ROUND";

  return {
    ok: true as const,
    round: {
      number,
      poetOrder,
      activeTurnId: room.rounds[number].activeTurnId,
    },
  };
}

/**
 * Start the NEXT round or end the game.
 * Preconditions:
 *  - room.state === "BETWEEN_ROUNDS"
 *  - currentRound exists and is complete
 * Behavior:
 *  - Create next round (number+1) with rotated poetOrder, set state = "IN_ROUND".
 *  - This function does **not** end the game; reaching winningScore does not affect round advancement.
 */
export function startNextRound(room: Room) {
  if (room.state !== "BETWEEN_ROUNDS") {
    return {
      ok: false as const,
      status: 400,
      error: {
        code: "BAD_STATE" as const,
        message: "Can only advance between rounds",
      },
    };
  }
  if (!room.currentRound || !room.rounds[room.currentRound]) {
    return {
      ok: false as const,
      status: 400,
      error: {
        code: "BAD_STATE" as const,
        message: "No current round to advance from",
      },
    };
  }
  if (!isRoundComplete(room)) {
    return {
      ok: false as const,
      status: 400,
      error: {
        code: "BAD_STATE" as const,
        message: "Current round is not complete",
      },
    };
  }

  const prevNo = room.currentRound;
  const prevOrder = room.rounds[prevNo].poetOrder;
  const nextNo = prevNo + 1;
  const poetOrder = rotatePoetOrder(prevOrder);

  room.rounds[nextNo] = {
    number: nextNo,
    poetOrder,
    completedTurns: [],
    activeTurnId: undefined,
  };
  room.currentRound = nextNo;
  room.state = "IN_ROUND";

  return {
    ok: true as const,
    round: {
      number: nextNo,
      poetOrder,
      activeTurnId: room.rounds[nextNo].activeTurnId,
    },
  };
}

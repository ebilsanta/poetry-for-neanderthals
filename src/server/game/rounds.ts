import type { Room } from "@server/game/types";

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

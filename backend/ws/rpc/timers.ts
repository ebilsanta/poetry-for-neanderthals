import type { Server } from "socket.io";

import { getRoom, setRoom } from "@server/game/store";
import { forceEndTurn } from "@server/game/turns.nextCard";

import { broadcastRoomState, broadcastRoundEnded } from "./broadcast";
import { emitCardVisibility, emitToEveryone } from "../fanout";

const turnTimers = new Map<string, NodeJS.Timeout>();

function timerKey(roomCode: string) {
  return roomCode;
}

export function clearTurnTimer(roomCode: string) {
  const key = timerKey(roomCode);
  const existing = turnTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    turnTimers.delete(key);
  }
}

export function scheduleTurnTimer(
  io: Server,
  roomCode: string,
  turnId: string,
  endsAt: number,
) {
  const delay = Math.max(0, endsAt - Date.now());
  clearTurnTimer(roomCode);
  const key = timerKey(roomCode);

  const timeout = setTimeout(() => {
    const room = getRoom(roomCode);
    if (!room || room.state !== "IN_ROUND" || !room.currentRound) return;

    const round = room.rounds[room.currentRound];
    if (!round || round.activeTurnId !== turnId) return;

    const result = forceEndTurn(room);
    if (!result) return;

    setRoom(room);

    const now = Date.now();
    broadcastRoomState(io, room, now);

    emitCardVisibility(
      io,
      room.code,
      result.poetId,
      result.teamId,
      "turns:card",
      {
        words: {
          turnId: result.turnId,
          card: null,
          turnEnded: result.turnEnded,
        },
        placeholder: {
          turnId: result.turnId,
          card: null,
          turnEnded: result.turnEnded,
        },
      },
    );

    emitToEveryone(io, room.code, "turns:ended", {
      turnId: result.turnId,
      turnEnded: result.turnEnded,
      scores: result.turnEnded.finalScores,
      lastCardDelta: result.lastCardDelta,
    });

    broadcastRoundEnded(io, room);

    clearTurnTimer(roomCode);
  }, delay);

  timeout.unref?.();
  turnTimers.set(key, timeout);
}

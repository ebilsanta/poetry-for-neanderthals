import type { Server } from "socket.io";

import { makeVisibleSnapshot } from "@server/game/visibility";
import type { Room } from "@server/game/types";

import { emitToPlayer, emitRoundEnded } from "../fanout";

export function broadcastRoomState(io: Server, room: Room, nowMs: number) {
  for (const player of Object.values(room.players)) {
    const snapshot = makeVisibleSnapshot(room, player.id, nowMs);
    emitToPlayer(io, room.code, player.id, "room:state", { room: snapshot });
  }
}

export function broadcastRoundEnded(io: Server, room: Room) {
  if (room.state !== "BETWEEN_ROUNDS") return;
  emitRoundEnded(io, room.code, {
    roomState: room.state,
    round: room.currentRound,
  });
}

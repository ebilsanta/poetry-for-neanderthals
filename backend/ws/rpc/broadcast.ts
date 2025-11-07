import type { Server } from "socket.io";

import { makeVisibleSnapshot } from "@server/game/visibility";
import type { Room } from "@server/game/types";

import { emitToPlayer } from "../fanout";

export function broadcastRoomState(io: Server, room: Room, nowMs: number) {
  for (const player of Object.values(room.players)) {
    const snapshot = makeVisibleSnapshot(room, player.id, nowMs);
    emitToPlayer(io, room.code, player.id, "room:state", { room: snapshot });
  }
}



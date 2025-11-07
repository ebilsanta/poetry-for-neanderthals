import type { Server, Socket } from "socket.io";
import { getRoom, setRoom } from "@server/game/store";
import type { Room } from "@server/game/types";
import { verifyTokenHash } from "@server/auth/token";

import { logicalRoom } from "./fanout";
import { registerRpcHandlers } from "./rpc";

type SocketData = {
  session?: { roomCode: string; playerId: string };
};

export type GameSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  SocketData
>;

type AuthSuccess = {
  roomCode: string;
  playerId: string;
};

const AUTH_ERROR = {
  ROOM_NOT_FOUND: new Error("ROOM_NOT_FOUND"),
  INVALID_TOKEN: new Error("FORBIDDEN"),
};

function parseString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function tryAuthenticateFromHandshake(socket: GameSocket): AuthSuccess | null {
  const auth = socket.handshake.auth ?? {};
  const query = socket.handshake.query ?? {};

  const rawCode =
    parseString((auth as Record<string, unknown>).code) ||
    parseString((auth as Record<string, unknown>).roomCode) ||
    parseString((query as Record<string, unknown>).code) ||
    parseString((query as Record<string, unknown>).roomCode);

  const rawToken =
    parseString((auth as Record<string, unknown>).token) ||
    parseString((auth as Record<string, unknown>).playerToken) ||
    parseString((query as Record<string, unknown>).token) ||
    parseString((query as Record<string, unknown>).playerToken);

  if (!rawCode || !rawToken) return null;

  const code = rawCode.toUpperCase();
  const room = getRoom(code);
  if (!room) throw AUTH_ERROR.ROOM_NOT_FOUND;

  const playerEntry = Object.values(room.players).find((player) =>
    verifyTokenHash(rawToken, player.tokenHash),
  );
  if (!playerEntry) throw AUTH_ERROR.INVALID_TOKEN;

  return { roomCode: room.code, playerId: playerEntry.id };
}

function joinLogicalRooms(socket: GameSocket, room: Room, playerId: string) {
  const player = room.players[playerId];
  if (!player) return;

  const teamRoom = logicalRoom.team(room.code, player.teamId);

  for (const roomName of socket.rooms) {
    if (
      roomName !== socket.id &&
      roomName.startsWith(`room:${room.code}:team:`) &&
      roomName !== teamRoom
    ) {
      void socket.leave(roomName);
    }
  }

  void socket.join(logicalRoom.all(room.code));
  void socket.join(logicalRoom.player(room.code, playerId));
  void socket.join(teamRoom);
}

function bindSession(socket: GameSocket, room: Room, playerId: string) {
  socket.data.session = { roomCode: room.code, playerId };
  joinLogicalRooms(socket, room, playerId);

  const player = room.players[playerId];
  if (player) {
    player.connected = true;
    player.socketId = socket.id;
    setRoom(room);
  }
}

function handleDisconnect(socket: GameSocket) {
  const session = socket.data.session;
  if (!session) return;

  const room = getRoom(session.roomCode);
  if (!room) return;

  const player = room.players[session.playerId];
  if (!player) return;

  if (player.socketId === socket.id) {
    player.connected = false;
    delete player.socketId;
    setRoom(room);
  }
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const gameSocket = socket as GameSocket;

    try {
      const auth = tryAuthenticateFromHandshake(gameSocket);
      if (auth) {
        gameSocket.data.session = auth;
      }
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error("FORBIDDEN"));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as GameSocket;
    const nowSession = socket.data.session;

    if (nowSession) {
      const room = getRoom(nowSession.roomCode);
      if (room && room.players[nowSession.playerId]) {
        bindSession(socket, room, nowSession.playerId);
      } else {
        socket.data.session = undefined;
      }
    }

    registerRpcHandlers(io, socket, {
      getContext() {
        const session = socket.data.session;
        if (!session) return undefined;
        const room = getRoom(session.roomCode);
        if (!room) {
          socket.data.session = undefined;
          return undefined;
        }
        const player = room.players[session.playerId];
        if (!player) {
          socket.data.session = undefined;
          return undefined;
        }
        return { room, player, playerId: session.playerId };
      },
      bind(room, playerId) {
        bindSession(socket, room, playerId);
      },
      clearSession() {
        socket.data.session = undefined;
      },
    });

    socket.on("disconnect", () => {
      handleDisconnect(socket);
    });
  });
}

import { io, type Socket } from "socket.io-client";

import type { VisibleRoomSnapshot } from "@lib/view/visible";

type ServerToClientEvents = {
  "room:state": (payload: { room: VisibleRoomSnapshot }) => void;
  "turns:card": (payload: unknown) => void;
  "turns:ended": (payload: unknown) => void;
  "rounds:ended": (payload: unknown) => void;
};

type ClientToServerEvents = Record<string, unknown>;

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type RoomSocketOptions = {
  baseUrl: string;
  roomCode: string;
  token?: string;
};

export function createRoomSocket({
  baseUrl,
  roomCode,
  token,
}: RoomSocketOptions): RoomSocket {
  const auth =
    token !== undefined ? { code: roomCode, token } : { code: roomCode };

  const socket = io(baseUrl, {
    transports: ["websocket"],
    autoConnect: false,
    auth,
  }) as RoomSocket;

  // Store values for debugging / reconnection awareness
  (socket as RoomSocket & { __roomCode?: string }).__roomCode = roomCode;

  return socket;
}

export function connectRoomSocket(socket: RoomSocket): Promise<RoomSocket> {
  if (socket.connected) {
    return Promise.resolve(socket);
  }

  return new Promise<RoomSocket>((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
    socket.connect();
  });
}

export function disconnectRoomSocket(socket: RoomSocket): void {
  if (socket.connected) {
    socket.disconnect();
  } else {
    socket.close();
  }
}

export function updateRoomSocketAuth(
  socket: RoomSocket,
  roomCode: string,
  token: string,
): void {
  const auth = { code: roomCode, token };
  (socket.io.opts as Record<string, unknown>).auth = auth;
}

export type RoomEventHandlers = {
  onRoomState?: (payload: { room: VisibleRoomSnapshot }) => void;
  onTurnCard?: (payload: unknown) => void;
  onTurnEnded?: (payload: unknown) => void;
  onRoundEnded?: (payload: unknown) => void;
};

export function attachRoomEventHandlers(
  socket: RoomSocket,
  handlers: RoomEventHandlers,
): () => void {
  const cleanups: Array<() => void> = [];

  if (handlers.onRoomState) {
    const listener = (payload: { room: VisibleRoomSnapshot }) =>
      handlers.onRoomState?.(payload);
    socket.on("room:state", listener);
    cleanups.push(() => socket.off("room:state", listener));
  }

  if (handlers.onTurnCard) {
    const listener = (payload: unknown) => handlers.onTurnCard?.(payload);
    socket.on("turns:card", listener);
    cleanups.push(() => socket.off("turns:card", listener));
  }

  if (handlers.onTurnEnded) {
    const listener = (payload: unknown) => handlers.onTurnEnded?.(payload);
    socket.on("turns:ended", listener);
    cleanups.push(() => socket.off("turns:ended", listener));
  }

  if (handlers.onRoundEnded) {
    const listener = (payload: unknown) => handlers.onRoundEnded?.(payload);
    socket.on("rounds:ended", listener);
    cleanups.push(() => socket.off("rounds:ended", listener));
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

import type { Server } from "socket.io";

import type { GameSocket } from "../handlers";
import type { Room, Player } from "@server/game/types";
import type { GuardError } from "@server/http/guards";
import type { ApiErrorCode } from "@lib/common/errors";

export type SessionState = { room: Room; player: Player; playerId: string };

export type RpcConnectionHelpers = {
  getContext(): SessionState | undefined;
  bind(room: Room, playerId: string): void;
  clearSession(): void;
};

export type Ack = (response: unknown) => void;

export type RpcHandlerContext = {
  io: Server;
  socket: GameSocket;
  helpers: RpcConnectionHelpers;
  now(): number;
};

export type RpcDefinition<Response> = {
  event: string;
  requiresAuth?: boolean;
  handler: (
    ctx: RpcHandlerContext,
    payload: unknown,
  ) => Promise<Response> | Response;
};

export type ErrorShape = { error: { code: ApiErrorCode; message: string } };

export function validationError(message: string): ErrorShape {
  return { error: { code: "VALIDATION", message } };
}

export function forbiddenError(message: string): ErrorShape {
  return { error: { code: "FORBIDDEN", message } };
}

export function unexpectedError(message: string): ErrorShape {
  return { error: { code: "BAD_STATE", message } };
}

export function guardErrorToResponse(guardError: GuardError): ErrorShape {
  return {
    error: {
      code: guardError.error.code,
      message: guardError.error.message,
    },
  };
}

export function requireSession(
  ctx: RpcHandlerContext,
): SessionState | undefined {
  return ctx.helpers.getContext();
}

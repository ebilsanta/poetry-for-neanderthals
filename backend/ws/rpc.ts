import type { Server } from "socket.io";

import type { GameSocket } from "./handlers";
import {
  type Ack,
  type RpcConnectionHelpers,
  type RpcDefinition,
  type RpcHandlerContext,
  unexpectedError,
} from "./rpc/context";
import { createRoomHandlers } from "./rpc/rooms";
import { createTurnHandlers } from "./rpc/turns";
import { createRoundHandlers } from "./rpc/rounds";

export function registerRpcHandlers(
  io: Server,
  socket: GameSocket,
  helpers: RpcConnectionHelpers,
) {
  const ctx: RpcHandlerContext = {
    io,
    socket,
    helpers,
    now: () => Date.now(),
  };

  const rpcHandlers: RpcDefinition<unknown>[] = [
    ...createRoomHandlers(),
    ...createTurnHandlers(),
    ...createRoundHandlers(),
  ];

  for (const def of rpcHandlers) {
    socket.on(def.event, async (payload: unknown, ack?: Ack) => {
      const replyFn: Ack = typeof ack === "function" ? ack : () => undefined;

      try {
        const response = await def.handler(ctx, payload);
        replyFn(response);
      } catch (err: unknown) {
        replyFn(
          unexpectedError(
            err instanceof Error ? err.message : "Unexpected error",
          ),
        );
      }
    });
  }
}

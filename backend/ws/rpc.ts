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
import { isErrorResponse, serializeForLog } from "./rpc/utils";

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
      const payloadPreview = serializeForLog(payload);
      console.info(
        `[rpc:${def.event}] received`,
        payloadPreview !== undefined ? { payload: payloadPreview } : {},
      );

      try {
        const response = await def.handler(ctx, payload);
        const responsePreview = serializeForLog(response);
        if (isErrorResponse(response)) {
          console.warn(
            `[rpc:${def.event}] responding with error`,
            responsePreview !== undefined ? { response: responsePreview } : {},
          );
        } else {
          console.info(
            `[rpc:${def.event}] responding`,
            responsePreview !== undefined ? { response: responsePreview } : {},
          );
        }
        replyFn(response);
      } catch (err: unknown) {
        console.error(`[rpc:${def.event}] handler threw`, err);
        replyFn(
          unexpectedError(
            err instanceof Error ? err.message : "Unexpected error",
          ),
        );
      }
    });
  }
}

import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { Server as SocketIOServer } from "socket.io";

import { registerSocketHandlers } from "../ws/handlers";
import { getRoom } from "@server/game/store";
import { initGameServer } from "@server/game/init";
import type { RoomState } from "@lib/common/enums";

type GetRoomResponse =
  | { room: { code: string; state: RoomState } }
  | { error: { code: string; message: string } };

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = "0.0.0.0";

export async function createServer() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowList = process.env.WS_CORS_ORIGIN?.split(",").map((o) =>
        o.trim(),
      );
      if (!allowList || allowList.length === 0 || !origin)
        return cb(null, true);
      cb(null, allowList.includes(origin));
    },
  });

  fastify.get<{ Params: { code: string } }, GetRoomResponse>(
    "/rooms/:code",
    async (request, reply) => {
      const code = (request.params.code ?? "").toUpperCase();
      const room = getRoom(code);
      if (!room) {
        return reply.status(404).send({
          error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
        });
      }

      return reply.send({
        room: {
          code: room.code,
          state: room.state,
        },
      });
    },
  );

  await fastify.ready();

  initGameServer();

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.WS_CORS_ORIGIN?.split(",").map((o) => o.trim()),
      credentials: true,
    },
  });

  registerSocketHandlers(io);

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await fastify.listen({ port, host });
  fastify.log.info({ port, host }, "WebSocket server listening");

  return { fastify, io };
}

if (require.main === module) {
  createServer().catch((err) => {
    console.error("Failed to start server", err);
    process.exitCode = 1;
  });
}

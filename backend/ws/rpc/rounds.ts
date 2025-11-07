import { makeVisibleSnapshot } from "@server/game/visibility";
import { startFirstRound, startNextRound } from "@server/game/rounds";
import { ensureCreator } from "@server/http/guards";
import { setRoom } from "@server/game/store";

import {
  type RpcDefinition,
  requireSession,
  forbiddenError,
  guardErrorToResponse,
} from "./context";

export function createRoundHandlers(): RpcDefinition<unknown>[] {
  return [
    {
      event: "rounds:start",
      requiresAuth: true,
      handler(localCtx) {
        const session = requireSession(localCtx);
        if (!session) {
          return forbiddenError("Not authenticated for this room");
        }

        const { room, playerId } = session;
        const creatorErr = ensureCreator(room, playerId);
        if (creatorErr) {
          return guardErrorToResponse(creatorErr);
        }

        const result = startFirstRound(room);
        if (!result.ok) {
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
            },
          };
        }

        setRoom(room);
        const snap = makeVisibleSnapshot(room, playerId, localCtx.now());

        return {
          round: result.round,
          roomState: room.state,
          room: snap,
        };
      },
    },
    {
      event: "rounds:next",
      requiresAuth: true,
      handler(localCtx) {
        const session = requireSession(localCtx);
        if (!session) {
          return forbiddenError("Not authenticated for this room");
        }

        const { room, playerId } = session;
        const creatorErr = ensureCreator(room, playerId);
        if (creatorErr) {
          return guardErrorToResponse(creatorErr);
        }

        const result = startNextRound(room);
        if (!result.ok) {
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
            },
          };
        }

        setRoom(room);
        const snap = makeVisibleSnapshot(room, playerId, localCtx.now());

        return {
          round: result.round,
          roomState: room.state,
          room: snap,
        };
      },
    },
  ];
}

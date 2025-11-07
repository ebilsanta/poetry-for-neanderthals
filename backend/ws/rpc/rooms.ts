import type { ApiErrorCode } from "@lib/common/errors";
import { CreateRoomRequest } from "@lib/contracts/http/rooms.create";
import { JoinRoomRequest } from "@lib/contracts/http/rooms.join";
import { UpdateSettingsRequest } from "@lib/contracts/http/rooms.settings";
import { AssignPlayersRequest } from "@lib/contracts/http/rooms.teams";

import { makeVisibleSnapshot } from "@server/game/visibility";
import { createRoom } from "@server/game/factory/createRoom";
import { joinRoom } from "@server/game/factory/joinRoom";
import { applySettings } from "@server/game/settings";
import { reassignPlayers } from "@server/game/teams";
import { setRoom } from "@server/game/store";
import { ensureCreator, ensureLobby } from "@server/http/guards";

import {
  type RpcDefinition,
  validationError,
  guardErrorToResponse,
  requireSession,
  forbiddenError,
} from "./context";
import { broadcastRoomState } from "./broadcast";

export function createRoomHandlers(): RpcDefinition<unknown>[] {
  return [
    {
      event: "rooms:create",
      async handler(localCtx, payload) {
        const parsed = CreateRoomRequest.safeParse(payload ?? {});
        if (!parsed.success) {
          return validationError(parsed.error.message);
        }

        try {
          const now = localCtx.now();
          const result = createRoom({
            name: parsed.data.name,
            settings: parsed.data.settings,
          });

          localCtx.helpers.bind(result.room, result.player.id);

          const visible = makeVisibleSnapshot(result.room, result.player.id, now);
          broadcastRoomState(localCtx.io, result.room, now);

          return {
            room: visible,
            player: {
              id: result.player.id,
              name: result.player.name,
              teamId: result.player.teamId,
              isCreator: result.player.isCreator,
            },
            playerToken: result.playerToken,
          };
        } catch (err: unknown) {
          return validationError(
            err instanceof Error ? err.message : "Failed to create room",
          );
        }
      },
    },
    {
      event: "rooms:join",
      async handler(localCtx, payload) {
        const envelope = (payload ?? {}) as {
          code?: string;
          body?: unknown;
        };
        const code = envelope.code?.toUpperCase();
        if (!code) {
          return validationError("Room code is required");
        }
        const parsed = JoinRoomRequest.safeParse(envelope.body ?? {});
        if (!parsed.success) {
          return validationError(parsed.error.message);
        }

        const result = joinRoom({ code, name: parsed.data.name });

        if (!result.ok) {
          return {
            error: {
              code: result.error.code as ApiErrorCode,
              message: result.error.message,
            },
          };
        }

        localCtx.helpers.bind(result.room, result.player.id);

        const now = localCtx.now();
        const visible = makeVisibleSnapshot(result.room, result.player.id, now);
        broadcastRoomState(localCtx.io, result.room, now);

        return {
          room: visible,
          player: {
            id: result.player.id,
            name: result.player.name,
            teamId: result.player.teamId,
            isCreator: false,
          },
          playerToken: result.playerToken,
        };
      },
    },
    {
      event: "rooms:settings:update",
      requiresAuth: true,
      handler(localCtx, payload) {
        const session = requireSession(localCtx);
        if (!session) {
          return forbiddenError("Not authenticated for this room");
        }

        const parsed = UpdateSettingsRequest.safeParse(payload ?? {});
        if (!parsed.success) {
          return validationError(parsed.error.message);
        }

        const { room, playerId } = session;
        const creatorErr = ensureCreator(room, playerId);
        if (creatorErr) {
          return guardErrorToResponse(creatorErr);
        }
        const lobbyErr = ensureLobby(room);
        if (lobbyErr) {
          return guardErrorToResponse(lobbyErr);
        }

        const updatedSettings = applySettings(room, parsed.data.settings);
        setRoom(room);

        const now = localCtx.now();
        const snap = makeVisibleSnapshot(room, playerId, now);
        broadcastRoomState(localCtx.io, room, now);

        return {
          room: snap,
          meta: { updatedSettings },
        };
      },
    },
    {
      event: "rooms:teams:assign",
      requiresAuth: true,
      handler(localCtx, payload) {
        const session = requireSession(localCtx);
        if (!session) {
          return forbiddenError("Not authenticated for this room");
        }

        const parsed = AssignPlayersRequest.safeParse(payload ?? {});
        if (!parsed.success) {
          return validationError(parsed.error.message);
        }

        const { room, playerId } = session;
        const creatorErr = ensureCreator(room, playerId);
        if (creatorErr) {
          return guardErrorToResponse(creatorErr);
        }
        const lobbyErr = ensureLobby(room);
        if (lobbyErr) {
          return guardErrorToResponse(lobbyErr);
        }

        const result = reassignPlayers(room, parsed.data.moves);
        if (!result.ok) {
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
            },
          };
        }

        setRoom(room);
        localCtx.helpers.bind(room, playerId);

        const now = localCtx.now();
        const snap = makeVisibleSnapshot(room, playerId, now);
        broadcastRoomState(localCtx.io, room, now);

        return {
          room: snap,
          meta: { reassigned: result.reassigned },
        };
      },
    },
  ];
}

import {
  StartTurnRequest,
  type StartTurnResponse,
} from "@lib/contracts/http/turns.start";
import {
  NextCardRequest,
  type NextCardResponse,
} from "@lib/contracts/http/turns.nextCard";
import { makeVisibleSnapshot } from "@server/game/visibility";
import { startTurn, shouldViewerSeeWords } from "@server/game/turns";
import { scoreCurrentAndMaybeNextCard } from "@server/game/turns.nextCard";
import { setRoom } from "@server/game/store";
import { getCardWords } from "@server/game/deck";

import {
  type RpcDefinition,
  validationError,
  forbiddenError,
  requireSession,
} from "./context";
import { broadcastRoomState } from "./broadcast";
import { emitCardVisibility, emitToEveryone } from "../fanout";

export function createTurnHandlers(): RpcDefinition<unknown>[] {
  return [
    {
      event: "turns:start",
      requiresAuth: true,
      handler(localCtx, payload) {
        const session = requireSession(localCtx);
        if (!session) {
          return forbiddenError("Not authenticated for this room");
        }

        const parsed = StartTurnRequest.safeParse(payload ?? {});
        if (!parsed.success) {
          return validationError(parsed.error.message);
        }

        const { room, playerId } = session;
        const result = startTurn(room, playerId, localCtx.now());
        if (!result.ok) {
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
            },
          } satisfies StartTurnResponse;
        }

        setRoom(room);

        const now = localCtx.now();
        const snap = makeVisibleSnapshot(room, playerId, now);
        broadcastRoomState(localCtx.io, room, now);

        const includeCard = (function () {
          if (result.cardForViewer) return result.cardForViewer;
          const activeTurn = snap.round?.activeTurn;
          if (!activeTurn) return undefined;
          const poetTeam = activeTurn.teamId;
          const viewerTeam = room.players[playerId].teamId;
          const isPoet = playerId === result.turn.poetId;
          const canSee = shouldViewerSeeWords(poetTeam, viewerTeam, isPoet);
          if (!canSee) return undefined;
          const liveTurn = room.turns[result.turn.id];
          if (!liveTurn?.activeCardId) return undefined;
          const words = getCardWords(liveTurn.activeCardId);
          return {
            id: words.id,
            onePoint: words.onePoint,
            threePoint: words.threePoint,
          };
        })();

        const liveTurn = room.turns[result.turn.id];
        const activeCardId = liveTurn?.activeCardId;
        if (liveTurn && activeCardId) {
          const words = getCardWords(activeCardId);
          emitCardVisibility(
            localCtx.io,
            room.code,
            liveTurn.poetId,
            liveTurn.teamId,
            "turns:card",
            {
              words: {
                turnId: result.turn.id,
                card: {
                  id: words.id,
                  onePoint: words.onePoint,
                  threePoint: words.threePoint,
                },
              },
              placeholder: {
                turnId: result.turn.id,
                card: null,
              },
            },
          );
        }

        return {
          turn: result.turn,
          card: includeCard,
          room: snap,
        } satisfies StartTurnResponse;
      },
    },
    {
      event: "turns:next-card",
      requiresAuth: true,
      handler(localCtx, payload) {
        const session = requireSession(localCtx);
        if (!session) {
          return forbiddenError("Not authenticated for this room");
        }

        const parsed = NextCardRequest.safeParse(payload ?? {});
        if (!parsed.success) {
          return validationError(parsed.error.message);
        }

        const { room, playerId } = session;
        const result = scoreCurrentAndMaybeNextCard(
          room,
          playerId,
          localCtx.now(),
          parsed.data,
        );

        if (!result.ok) {
          return {
            error: {
              code: result.error.code,
              message: result.error.message,
            },
          } satisfies NextCardResponse;
        }

        setRoom(room);

        const now = localCtx.now();
        const snap = makeVisibleSnapshot(room, playerId, now);
        broadcastRoomState(localCtx.io, room, now);

        const liveTurn = room.turns[result.turnId];

        if (result.turnEnded) {
          if (liveTurn) {
            emitCardVisibility(
              localCtx.io,
              room.code,
              liveTurn.poetId,
              liveTurn.teamId,
              "turns:card",
              {
                words: {
                  turnId: result.turnId,
                  card: null,
                  turnEnded: result.turnEnded,
                },
                placeholder: {
                  turnId: result.turnId,
                  card: null,
                  turnEnded: result.turnEnded,
                },
              },
            );
          }
          emitToEveryone(localCtx.io, room.code, "turns:ended", {
            turnId: result.turnId,
            turnEnded: result.turnEnded,
            scores: result.scores,
            lastCardDelta: result.lastCardDelta,
          });
        } else if (liveTurn && liveTurn.activeCardId) {
          const words = getCardWords(liveTurn.activeCardId);
          emitCardVisibility(
            localCtx.io,
            room.code,
            liveTurn.poetId,
            liveTurn.teamId,
            "turns:card",
            {
              words: {
                turnId: result.turnId,
                card: {
                  id: words.id,
                  onePoint: words.onePoint,
                  threePoint: words.threePoint,
                },
                remainingMs: result.remainingMs,
              },
              placeholder: {
                turnId: result.turnId,
                card: null,
                remainingMs: result.remainingMs,
              },
            },
          );
        }

        if (result.turnEnded) {
          return {
            turnId: result.turnId,
            scores: result.scores,
            lastCardDelta: result.lastCardDelta,
            turnEnded: result.turnEnded,
            room: snap,
          } satisfies NextCardResponse;
        }

        return {
          turnId: result.turnId,
          scores: result.scores,
          lastCardDelta: result.lastCardDelta,
          nextCard: result.nextCard!,
          remainingMs: result.remainingMs!,
          room: snap,
        } satisfies NextCardResponse;
      },
    },
  ];
}

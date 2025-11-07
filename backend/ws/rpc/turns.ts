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

        const snap = makeVisibleSnapshot(room, playerId, localCtx.now());

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

        const snap = makeVisibleSnapshot(room, playerId, localCtx.now());

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

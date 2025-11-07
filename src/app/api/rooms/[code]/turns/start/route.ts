import { NextRequest, NextResponse } from "next/server";
import {
  StartTurnRequest,
  StartTurnResponse,
} from "@lib/contracts/http/turns.start";
import { getRoom, setRoom } from "@server/game/store";
import { requireAuth } from "@server/http/guards";
import { startTurn, shouldViewerSeeWords } from "@server/game/turns";
import { makeVisibleSnapshot } from "@server/game/visibility";
import { getCardWords } from "@server/game/deck";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const room = getRoom((code || "").toUpperCase());
  if (!room) {
    return NextResponse.json(
      {
        error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
      } satisfies StartTurnResponse,
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = StartTurnRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies StartTurnResponse,
      { status: 400 },
    );
  }

  // Caller must be an authenticated player in this room
  const auth = requireAuth(req, room);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error } satisfies StartTurnResponse,
      { status: auth.status },
    );
  }

  // Start the turn (caller must be the next poet)
  const result = startTurn(room, auth.playerId, Date.now());
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error } satisfies StartTurnResponse,
      { status: result.status },
    );
  }

  // Persist mutation
  setRoom(room);

  // Build viewer-scoped snapshot
  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());

  // Decide whether to include card words in HTTP response for this viewer
  // (Poet always receives; if you later allow non-poet calls, keep this logic.)
  const includeCard =
    result.cardForViewer ??
    (snap.round?.activeTurn
      ? (function () {
          const poetTeam = snap.round!.activeTurn!.teamId;
          const viewerTeam = room.players[auth.playerId].teamId;
          const isPoet = auth.playerId === result.turn.poetId;
          const canSee = shouldViewerSeeWords(poetTeam, viewerTeam, isPoet);
          if (!canSee || !room.turns[result.turn.id].activeCardId)
            return undefined;
          // Look up the words here if needed; startTurn already returned for poet
          const cardId = room.turns[result.turn.id].activeCardId!;
          const { id, onePoint, threePoint } = getCardWords(cardId);
          return { id, onePoint, threePoint };
        })()
      : undefined);

  return NextResponse.json(
    {
      turn: result.turn,
      card: includeCard,
      room: snap,
    } satisfies StartTurnResponse,
    { status: 200 },
  );
}

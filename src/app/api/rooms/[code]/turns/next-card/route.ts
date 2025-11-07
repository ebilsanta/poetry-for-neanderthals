import { NextRequest, NextResponse } from "next/server";
import {
  NextCardRequest,
  NextCardResponse,
} from "@lib/contracts/http/turns.nextCard";
import { getRoom, setRoom } from "@server/game/store";
import { requireAuth } from "@server/http/guards";
import { scoreCurrentAndMaybeNextCard } from "@server/game/turns.nextCard";
import { makeVisibleSnapshot } from "@server/game/visibility";

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
      } satisfies NextCardResponse,
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = NextCardRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies NextCardResponse,
      { status: 400 },
    );
  }

  const auth = requireAuth(req, room);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error } satisfies NextCardResponse, {
      status: auth.status,
    });
  }

  const result = scoreCurrentAndMaybeNextCard(
    room,
    auth.playerId,
    Date.now(),
    parsed.data,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error } satisfies NextCardResponse,
      { status: result.status },
    );
  }

  setRoom(room);

  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());

  // Map to wire shape
  const payload: NextCardResponse =
    "turnEnded" in result && result.turnEnded
      ? {
          turnId: result.turnId,
          scores: result.scores,
          lastCardDelta: result.lastCardDelta,
          turnEnded: result.turnEnded,
          room: snap,
        }
      : {
          turnId: result.turnId,
          scores: result.scores,
          lastCardDelta: result.lastCardDelta,
          nextCard: result.nextCard!,
          remainingMs: result.remainingMs!,
          room: snap,
        };

  return NextResponse.json(payload, { status: 200 });
}

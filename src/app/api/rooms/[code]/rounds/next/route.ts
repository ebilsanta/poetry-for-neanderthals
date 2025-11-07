import { NextRequest, NextResponse } from "next/server";
import {
  NextRoundRequest,
  NextRoundResponse,
} from "@lib/contracts/http/rounds.next";
import { getRoom, setRoom } from "@server/game/store";
import { requireAuth, ensureCreator } from "@server/http/guards";
import { startNextRound } from "@server/game/rounds";
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
      } satisfies NextRoundResponse,
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = NextRoundRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies NextRoundResponse,
      { status: 400 },
    );
  }

  const auth = requireAuth(req, room);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error } satisfies NextRoundResponse,
      { status: auth.status },
    );
  }

  const creatorErr = ensureCreator(room, auth.playerId);
  if (creatorErr) {
    return NextResponse.json(
      { error: creatorErr.error } satisfies NextRoundResponse,
      { status: creatorErr.status },
    );
  }

  const result = startNextRound(room);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error } satisfies NextRoundResponse,
      { status: result.status },
    );
  }

  // Persist and respond
  setRoom(room);
  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());

  return NextResponse.json(
    {
      round: result.round,
      roomState: room.state, // "IN_ROUND"
      room: snap,
    } satisfies NextRoundResponse,
    { status: 200 },
  );
}

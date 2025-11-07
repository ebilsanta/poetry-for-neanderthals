import { NextRequest, NextResponse } from "next/server";
import {
  StartRoundRequest,
  StartRoundResponse,
} from "@lib/contracts/http/rounds.start";
import { getRoom, setRoom } from "@server/game/store";
import { requireAuth, ensureCreator } from "@server/http/guards";
import { startFirstRound } from "@server/game/rounds";
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
      } satisfies StartRoundResponse,
      { status: 404 },
    );
  }

  // Body is optional/empty but validate anyway to keep parity with your contract
  const body = await req.json().catch(() => ({}));
  const parsed = StartRoundRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies StartRoundResponse,
      { status: 400 },
    );
  }

  // AuthN
  const auth = requireAuth(req, room);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error } satisfies StartRoundResponse,
      { status: auth.status },
    );
  }

  // AuthZ: creator only
  const creatorErr = ensureCreator(room, auth.playerId);
  if (creatorErr) {
    return NextResponse.json(
      { error: creatorErr.error } satisfies StartRoundResponse,
      { status: creatorErr.status },
    );
  }

  // Start round
  const result = startFirstRound(room);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error } satisfies StartRoundResponse,
      { status: result.status },
    );
  }

  setRoom(room);

  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());
  return NextResponse.json(
    {
      round: result.round,
      roomState: room.state, // "IN_ROUND"
      room: snap,
    } satisfies StartRoundResponse,
    { status: 200 },
  );
}

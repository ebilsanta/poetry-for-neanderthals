import { NextRequest, NextResponse } from "next/server";
import {
  AssignPlayersRequest,
  AssignPlayersResponse,
} from "@lib/contracts/http/rooms.teams";
import { getRoom, setRoom } from "@server/game/store";
import { requireAuth, ensureCreator, ensureLobby } from "@server/http/guards";
import { reassignPlayers } from "@server/game/teams";
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
      } satisfies AssignPlayersResponse,
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = AssignPlayersRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies AssignPlayersResponse,
      { status: 400 },
    );
  }

  // AuthN
  const auth = requireAuth(req, room);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error } satisfies AssignPlayersResponse,
      { status: auth.status },
    );
  }

  // AuthZ + state (creator + lobby-only)
  const creatorErr = ensureCreator(room, auth.playerId);
  if (creatorErr) {
    return NextResponse.json(
      { error: creatorErr.error } satisfies AssignPlayersResponse,
      { status: creatorErr.status },
    );
  }
  const lobbyErr = ensureLobby(room);
  if (lobbyErr) {
    return NextResponse.json(
      { error: lobbyErr.error } satisfies AssignPlayersResponse,
      { status: lobbyErr.status },
    );
  }

  // Apply moves
  const result = reassignPlayers(room, parsed.data.moves);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error } satisfies AssignPlayersResponse,
      { status: result.status },
    );
  }

  setRoom(room);
  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());

  return NextResponse.json(
    {
      room: snap,
      meta: { reassigned: result.reassigned },
    } satisfies AssignPlayersResponse,
    { status: 200 },
  );
}

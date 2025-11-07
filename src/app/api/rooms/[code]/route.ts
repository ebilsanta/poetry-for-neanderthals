import { NextRequest, NextResponse } from "next/server";
import { GetRoomResponse } from "@lib/contracts/http/rooms.get";
import { getRoom } from "@server/game/store";
import { makeVisibleSnapshot } from "@server/game/visibility";
import { requireAuth } from "@server/http/guards";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: codeParam } = await params;
  const code = (codeParam || "").toUpperCase();
  const room = getRoom(code);
  if (!room) {
    const res: GetRoomResponse = {
      error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
    };
    return NextResponse.json(res, { status: 404 });
  }

  // Auth: Authorization: Bearer <playerToken>
  const auth = requireAuth(req, room);
  if ("error" in auth) {
    const res: GetRoomResponse = { error: auth.error };
    return NextResponse.json(res, { status: auth.status });
  }

  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());
  return NextResponse.json({ room: snap } satisfies GetRoomResponse, {
    status: 200,
  });
}

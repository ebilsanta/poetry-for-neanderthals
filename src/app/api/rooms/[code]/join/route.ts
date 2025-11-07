import { NextRequest, NextResponse } from "next/server";
import {
  JoinRoomRequest,
  JoinRoomResponse,
} from "@lib/contracts/http/rooms.join";
import { joinRoom } from "@server/game/factory/joinRoom";
import { makeVisibleSnapshot } from "@server/game/visibility";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const body = await req.json().catch(() => ({}));
  const parsed = JoinRoomRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies JoinRoomResponse,
      { status: 400 },
    );
  }

  const { code: codeParam } = await params;
  const code = (codeParam || "").toUpperCase();
  const result = joinRoom({ code, name: parsed.data.name });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const visibleRoom = makeVisibleSnapshot(
    result.room,
    result.player.id,
    Date.now(),
  );

  return NextResponse.json(
    {
      room: visibleRoom,
      player: {
        id: result.player.id,
        name: result.player.name,
        teamId: result.player.teamId,
        isCreator: false,
      },
      playerToken: result.playerToken,
    } satisfies JoinRoomResponse,
    { status: 200 },
  );
}

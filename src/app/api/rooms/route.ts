import { NextRequest, NextResponse } from "next/server";
import {
  CreateRoomRequest,
  CreateRoomResponse,
} from "@lib/contracts/http/rooms.create";
import { createRoom } from "@server/game/factory/createRoom";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateRoomRequest.safeParse(body);
  if (!parsed.success) {
    const res: CreateRoomResponse = {
      error: { code: "VALIDATION", message: parsed.error.message },
    };
    return NextResponse.json(res, { status: 400 });
  }

  try {
    const { name, settings } = parsed.data;
    const result = createRoom({ name, settings });

    const response: CreateRoomResponse = {
      room: result.visibleRoom,
      player: {
        id: result.player.id,
        name: result.player.name,
        teamId: result.player.teamId,
        isCreator: result.player.isCreator,
      },
      playerToken: result.playerToken,
    };
    return new NextResponse(JSON.stringify(response), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/rooms/${result.room.code}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const res: CreateRoomResponse = {
      error: {
        code: "BAD_STATE",
        message: err instanceof Error ? err.message : "Failed to create room",
      },
    };
    return NextResponse.json(res, { status: 400 });
  }
}

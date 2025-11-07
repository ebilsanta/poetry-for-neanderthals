import { NextRequest, NextResponse } from "next/server";
import {
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from "@lib/contracts/http/rooms.settings";
import { getRoom, setRoom } from "@server/game/store";
import { makeVisibleSnapshot } from "@server/game/visibility";
import { requireAuth, ensureCreator, ensureLobby } from "@server/http/guards";
import { applySettings } from "@server/game/settings";

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
      } satisfies UpdateSettingsResponse,
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSettingsRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION", message: parsed.error.message },
      } satisfies UpdateSettingsResponse,
      { status: 400 },
    );
  }

  // AuthN
  const auth = requireAuth(req, room);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error } satisfies UpdateSettingsResponse,
      { status: auth.status },
    );
  }

  // AuthZ + state checks
  const creatorErr = ensureCreator(room, auth.playerId);
  if (creatorErr) {
    return NextResponse.json(
      { error: creatorErr.error } satisfies UpdateSettingsResponse,
      { status: creatorErr.status },
    );
  }
  const lobbyErr = ensureLobby(room);
  if (lobbyErr) {
    return NextResponse.json(
      { error: lobbyErr.error } satisfies UpdateSettingsResponse,
      { status: lobbyErr.status },
    );
  }

  // Apply settings
  const updatedSettings = applySettings(room, parsed.data.settings);
  setRoom(room);

  const snap = makeVisibleSnapshot(room, auth.playerId, Date.now());
  return NextResponse.json(
    { room: snap, meta: { updatedSettings } } satisfies UpdateSettingsResponse,
    { status: 200 },
  );
}

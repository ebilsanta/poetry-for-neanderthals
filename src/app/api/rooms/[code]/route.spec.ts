import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { createRoom } from "@server/game/factory/createRoom";
import { NextRequest } from "next/server";

function makeGetRequest(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // NextRequest init shim for tests
  return new NextRequest(url, { headers });
}

describe("GET /api/rooms/:code", () => {
  it("returns 200 and a visible room snapshot for authorized player", async () => {
    const { room, playerToken, player } = createRoom({ name: "Kai" });
    const req = makeGetRequest(
      `http://localhost/api/rooms/${room.code}`,
      playerToken,
    );
    const res = await GET(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.room?.code).toBe(room.code);
    expect(json.room?.players?.[0]?.id).toBe(player.id);
    // teamNames should be present per our visibility builder defaults
    expect(json.room?.settings?.teamNames).toBeTruthy();
  });

  it("returns 404 for unknown room", async () => {
    const req = makeGetRequest("http://localhost/api/rooms/ZZZ", "fake");
    const res = await GET(req, { params: Promise.resolve({ code: "ZZZ" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("ROOM_NOT_FOUND");
  });

  it("returns 400 when Authorization header is missing", async () => {
    const { room } = createRoom({ name: "Kai" });
    const req = makeGetRequest(`http://localhost/api/rooms/${room.code}`);
    const res = await GET(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION");
  });

  it("returns 403 on invalid token", async () => {
    const { room } = createRoom({ name: "Kai" });
    const req = makeGetRequest(
      `http://localhost/api/rooms/${room.code}`,
      "wrong",
    );
    const res = await GET(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("FORBIDDEN");
  });
});

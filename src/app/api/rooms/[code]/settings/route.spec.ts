import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createRoom } from "@server/game/factory/createRoom";
import { getRoom, setRoom } from "@server/game/store";
import { generateToken, hashToken } from "@server/auth/token";

function makePost(url: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe.skip("POST /api/rooms/:code/settings", () => {
  it("updates settings when creator in lobby", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const req = makePost(
      `http://localhost/api/rooms/${room.code}/settings`,
      { settings: { turnSeconds: 120, allowPass: true } },
      playerToken,
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.meta.updatedSettings).toEqual(
      expect.arrayContaining(["turnSeconds", "allowPass"]),
    );
    expect(json.room.settings.turnSeconds).toBe(120);
    expect(json.room.settings.allowPass).toBe(true);
  });

  it("rejects if not creator", async () => {
    const { room } = createRoom({ name: "Creator" });

    // add a non-creator player and use their token
    const pId = "p_join";
    const token = generateToken();
    const r = getRoom(room.code)!;
    r.players[pId] = {
      id: pId,
      name: "Joiner",
      teamId: "B",
      isCreator: false,
      connected: true,
      tokenHash: hashToken(token),
    };
    r.teams.B.players.push(pId);
    setRoom(r);

    const req = makePost(
      `http://localhost/api/rooms/${room.code}/settings`,
      { settings: { winningScore: 77 } },
      token,
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects when room is not in LOBBY", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const r = getRoom(room.code)!;
    r.state = "IN_ROUND";
    setRoom(r);

    const req = makePost(
      `http://localhost/api/rooms/${room.code}/settings`,
      { settings: { winningScore: 60 } },
      playerToken,
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_STATE");
  });

  it("returns 404 for unknown room", async () => {
    const req = makePost(
      `http://localhost/api/rooms/ZZZ/settings`,
      { settings: { winningScore: 60 } },
      "fake",
    );
    const res = await POST(req, { params: Promise.resolve({ code: "ZZZ" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("returns 400 on validation errors (empty settings object)", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const req = makePost(
      `http://localhost/api/rooms/${room.code}/settings`,
      { settings: {} },
      playerToken,
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION");
  });
});

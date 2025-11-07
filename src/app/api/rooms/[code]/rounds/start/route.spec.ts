import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createRoom } from "@server/game/factory/createRoom";
import { getRoom, setRoom } from "@server/game/store";
import { generateToken, hashToken } from "@server/auth/token";

function makePost(url: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
}

function addPlayer(roomCode: string, name: string, teamId: "A" | "B") {
  const room = getRoom(roomCode)!;
  const id = `p_${Math.random().toString(36).slice(2, 8)}`;
  const token = generateToken();
  room.players[id] = {
    id,
    name,
    teamId,
    isCreator: false,
    connected: true,
    tokenHash: hashToken(token),
  };
  // ensure membership
  room.teams.A.players = room.teams.A.players.filter((x) => x !== id);
  room.teams.B.players = room.teams.B.players.filter((x) => x !== id);
  room.teams[teamId].players.push(id);
  setRoom(room);
  return { id, token };
}

describe.skip("POST /api/rooms/:code/rounds/start", () => {
  it("starts the first round (creator only) and returns poet order", async () => {
    const { room, playerToken, player } = createRoom({ name: "Creator" }); // creator on A
    // Add two more players to ensure alternation
    const { id: a2 } = addPlayer(room.code, "A2", "A");
    const { id: b1 } = addPlayer(room.code, "B1", "B");

    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/start`,
        {},
        playerToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.roomState).toBe("IN_ROUND");
    expect(json.round.number).toBe(1);
    // Alternating A then B row-wise: [creator(A), b1(B), a2(A)]
    const order = json.round.poetOrder;
    expect(Array.isArray(order)).toBe(true);
    expect(order.length).toBe(3);
    expect(order[0]).toBe(player.id);
    expect(order).toContain(b1);
    expect(order).toContain(a2);
  });

  it("rejects if not creator", async () => {
    const { room } = createRoom({ name: "Creator" });
    const { token: notCreatorToken } = addPlayer(room.code, "Guest", "B");

    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/start`,
        {},
        notCreatorToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects if not in LOBBY", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const r = getRoom(room.code)!;
    r.state = "IN_ROUND";
    setRoom(r);

    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/start`,
        {},
        playerToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_STATE");
  });

  it("rejects when a team has zero players", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    // Remove all B players to trigger validation
    const r = getRoom(room.code)!;
    r.teams.B.players = [];
    setRoom(r);

    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/start`,
        {},
        playerToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION");
  });

  it("returns 404 for unknown room", async () => {
    const res = await POST(
      makePost(`http://localhost/api/rooms/ZZZ/rounds/start`, {}, "fake"),
      { params: Promise.resolve({ code: "ZZZ" }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("ROOM_NOT_FOUND");
  });
});

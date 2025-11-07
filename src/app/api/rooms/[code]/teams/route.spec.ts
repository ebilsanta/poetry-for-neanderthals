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

describe.skip("POST /api/rooms/:code/teams", () => {
  it("reassigns players when creator in lobby", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" }); // creator on A
    const { id: p1 } = addPlayer(room.code, "Bob", "A");
    const { id: p2 } = addPlayer(room.code, "Eve", "B");

    const req = makePost(
      `http://localhost/api/rooms/${room.code}/teams`,
      {
        moves: [
          { playerId: p1, teamId: "B" },
          { playerId: p2, teamId: "A" },
        ],
      },
      playerToken,
    );

    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();

    // meta reflects changed moves
    expect(json.meta.reassigned).toEqual(
      expect.arrayContaining([
        { playerId: p1, teamId: "B" },
        { playerId: p2, teamId: "A" },
      ]),
    );

    // room state updated
    expect(json.room.teams.A.players).toEqual(expect.arrayContaining([p2]));
    expect(json.room.teams.B.players).toEqual(expect.arrayContaining([p1]));
  });

  it("rejects unknown player id with 400 VALIDATION", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });

    const req = makePost(
      `http://localhost/api/rooms/${room.code}/teams`,
      { moves: [{ playerId: "nope", teamId: "B" }] },
      playerToken,
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION");
  });

  it("rejects if not creator", async () => {
    const { room } = createRoom({ name: "Creator" });
    const { token: notCreatorToken } = addPlayer(room.code, "Guest", "B");

    makePost(
      `http://localhost/api/rooms/${room.code}/teams`,
      { moves: [] }, // will fail zod; use a valid move to reach authZ
      notCreatorToken,
    );
    // give a valid move so we actually test authZ:
    const { id: p1 } = addPlayer(room.code, "Alex", "A");
    const req2 = makePost(
      `http://localhost/api/rooms/${room.code}/teams`,
      { moves: [{ playerId: p1, teamId: "B" }] },
      notCreatorToken,
    );
    const res = await POST(req2, {
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

    const { id: p1 } = addPlayer(room.code, "Sam", "A");
    const req = makePost(
      `http://localhost/api/rooms/${room.code}/teams`,
      { moves: [{ playerId: p1, teamId: "B" }] },
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
      `http://localhost/api/rooms/ZZZ/teams`,
      { moves: [{ playerId: "x", teamId: "B" }] },
      "fake",
    );
    const res = await POST(req, { params: Promise.resolve({ code: "ZZZ" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("ignores no-op moves (already on that team) but still succeeds", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const { id: p1 } = addPlayer(room.code, "Pat", "B");

    const req = makePost(
      `http://localhost/api/rooms/${room.code}/teams`,
      { moves: [{ playerId: p1, teamId: "B" }] }, // no-op
      playerToken,
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    // either reassigned is empty or undefined; both acceptable
    expect(
      Array.isArray(json.meta?.reassigned) ? json.meta.reassigned.length : 0,
    ).toBe(0);
  });
});

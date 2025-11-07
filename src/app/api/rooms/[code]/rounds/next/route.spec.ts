import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createRoom } from "@server/game/factory/createRoom";
import { getRoom, setRoom } from "@server/game/store";

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

describe("POST /api/rooms/:code/rounds/next", () => {
  it("starts the next round with rotated poet order", async () => {
    const { room, playerToken, player } = createRoom({ name: "Creator" }); // A
    // Add a few players so order is non-trivial
    const r = getRoom(room.code)!;
    // team A already has creator; add one more A and two Bs
    const a2 = "p_A2";
    r.players[a2] = {
      id: a2,
      name: "A2",
      teamId: "A",
      isCreator: false,
      connected: true,
      tokenHash: "x",
    };
    r.teams.A.players.push(a2);
    const b1 = "p_B1";
    r.players[b1] = {
      id: b1,
      name: "B1",
      teamId: "B",
      isCreator: false,
      connected: true,
      tokenHash: "x",
    };
    const b2 = "p_B2";
    r.players[b2] = {
      id: b2,
      name: "B2",
      teamId: "B",
      isCreator: false,
      connected: true,
      tokenHash: "x",
    };
    r.teams.B.players.push(b1, b2);

    // Set up Round 1
    const poetOrder = [player.id, b1, a2, b2];
    r.rounds[1] = {
      number: 1,
      poetOrder,
      completedTurns: poetOrder.slice(),
      activeTurnId: undefined,
    };
    r.currentRound = 1;
    r.state = "BETWEEN_ROUNDS";
    setRoom(r);

    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/next`,
        {},
        playerToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.roomState).toBe("IN_ROUND");
    expect(json.round.number).toBe(2);
    // rotated order: [b1, a2, b2, creator]
    expect(json.round.poetOrder).toEqual([b1, a2, b2, player.id]);
  });

  it("does NOT end the game even if winningScore is reached; starts next round", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const r = getRoom(room.code)!;
    // Minimal teams for order
    const a2 = "p_A2";
    r.players[a2] = {
      id: a2,
      name: "A2",
      teamId: "A",
      isCreator: false,
      connected: true,
      tokenHash: "x",
    };
    r.teams.A.players.push(a2);
    const b1 = "p_B1";
    r.players[b1] = {
      id: b1,
      name: "B1",
      teamId: "B",
      isCreator: false,
      connected: true,
      tokenHash: "x",
    };
    r.teams.B.players.push(b1);
    r.settings.winningScore = 10;
    r.teams.A.score = 12; // would have 'won' under old rule
    // Round 1 complete → BETWEEN_ROUNDS
    const order = [r.creatorId, b1, a2];
    r.rounds[1] = {
      number: 1,
      poetOrder: order,
      completedTurns: order.slice(),
      activeTurnId: undefined,
    };
    r.currentRound = 1;
    r.state = "BETWEEN_ROUNDS";
    setRoom(r);
    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/next`,
        {},
        playerToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.roomState).toBe("IN_ROUND"); // no longer ENDED
    expect(json.round.number).toBe(2); // next round started
    expect(Array.isArray(json.round.poetOrder)).toBe(true);
  });

  it("rejects if not creator", async () => {
    const { room } = createRoom({ name: "Creator" });
    // add non-creator token
    const r = getRoom(room.code)!;
    const guest = "p_guest";
    r.players[guest] = {
      id: guest,
      name: "Guest",
      teamId: "B",
      isCreator: false,
      connected: true,
      tokenHash: "x",
    };
    r.teams.B.players.push(guest);
    // set R1 complete
    r.rounds[1] = {
      number: 1,
      poetOrder: [room.creatorId, guest],
      completedTurns: [room.creatorId, guest],
      activeTurnId: undefined,
    };
    r.currentRound = 1;
    r.state = "BETWEEN_ROUNDS";
    setRoom(r);

    const req = new NextRequest(
      `http://localhost/api/rooms/${room.code}/rounds/next`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer notcreatortoken",
        },
        body: JSON.stringify({}),
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects if round incomplete or state not BETWEEN_ROUNDS", async () => {
    const { room, playerToken } = createRoom({ name: "Creator" });
    const r = getRoom(room.code)!;
    // Prepare R1 but not complete
    r.rounds[1] = {
      number: 1,
      poetOrder: [room.creatorId],
      completedTurns: [],
      activeTurnId: undefined,
    };
    r.currentRound = 1;
    r.state = "IN_ROUND"; // wrong state
    setRoom(r);

    const res = await POST(
      makePost(
        `http://localhost/api/rooms/${room.code}/rounds/next`,
        {},
        playerToken,
      ),
      { params: Promise.resolve({ code: room.code }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_STATE");
  });

  it("404 for unknown room", async () => {
    const res = await POST(
      makePost(`http://localhost/api/rooms/ZZZ/rounds/next`, {}, "fake"),
      { params: Promise.resolve({ code: "ZZZ" }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("ROOM_NOT_FOUND");
  });
});

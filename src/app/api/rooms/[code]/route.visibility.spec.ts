import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createRoom } from "@server/game/factory/createRoom";
import { getRoom, setRoom } from "@server/game/store";
import { generateToken, hashToken } from "@server/auth/token";

/**
 * Test helpers
 */
function makeNextRequest(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(url, { headers });
}

function addPlayer(roomCode: string, name: string, teamId: "A" | "B") {
  const room = getRoom(roomCode)!;
  const id = `p_${Math.random().toString(36).slice(2, 10)}`;
  const token = generateToken();
  const player = {
    id,
    name,
    teamId,
    isCreator: false,
    connected: false,
    tokenHash: hashToken(token),
  };
  room.players[id] = player;
  // move team membership
  room.teams.A.players = room.teams.A.players.filter((x) => x !== id);
  room.teams.B.players = room.teams.B.players.filter((x) => x !== id);
  room.teams[teamId].players.push(id);
  setRoom(room);
  return { player, token };
}

function activateTurn(roomCode: string, poetId: string, poetTeam: "A" | "B") {
  const room = getRoom(roomCode)!;

  // Create the round
  room.currentRound = 1;
  room.rounds[1] = {
    number: 1,
    poetOrder: [poetId],
    completedTurns: [],
    activeTurnId: "t1",
  };

  // Create the active turn with a current card
  const endsAt = Date.now() + 30_000; // 30s left
  room.turns["t1"] = {
    id: "t1",
    roundNumber: 1,
    poetId,
    teamId: poetTeam,
    startedAt: endsAt - 30_000,
    endsAt,
    timerRemaining: undefined,
    activeCardId: "card-123",
    outcomes: [],
  };

  setRoom(room);
  return { endsAt };
}

describe("GET /api/rooms/:code — card visibility", () => {
  it("Poet sees placeholder words for the active card", async () => {
    const { room, player, playerToken } = createRoom({ name: "Creator" }); // creator is on Team A
    // Make creator the poet
    activateTurn(room.code, player.id, "A");

    const req = makeNextRequest(
      `http://localhost/api/rooms/${room.code}`,
      playerToken,
    );
    const res = await GET(req, { params: { code: room.code } });
    expect(res.status).toBe(200);

    const json = await res.json();
    const activeCard = json.room?.round?.activeTurn?.activeCard;
    expect(activeCard?.id).toBe("card-123");
    // Snapshot never carries real words; placeholders only for authorized viewers
    expect(activeCard?.onePoint).toBe("REDACTED_AT_SEND");
    expect(activeCard?.threePoint).toBe("REDACTED_AT_SEND");
  });

  it("Opposing team member sees placeholder words; teammate does not", async () => {
    const {
      room,
      player: creator,
      playerToken: creatorToken,
    } = createRoom({ name: "Creator" }); // Team A
    // Add a teammate on Team A and an opponent on Team B
    const { token: teammateToken } = addPlayer(room.code, "Teammate", "A");
    const { token: opponentToken } = addPlayer(room.code, "Opponent", "B");

    // Make creator (Team A) the poet
    activateTurn(room.code, creator.id, "A");

    // Opponent view → placeholders present
    {
      const req = makeNextRequest(
        `http://localhost/api/rooms/${room.code}`,
        opponentToken,
      );
      const res = await GET(req, { params: { code: room.code } });
      expect(res.status).toBe(200);
      const json = await res.json();
      const activeCard = json.room?.round?.activeTurn?.activeCard;
      expect(activeCard?.id).toBe("card-123");
      expect(activeCard?.onePoint).toBe("REDACTED_AT_SEND");
      expect(activeCard?.threePoint).toBe("REDACTED_AT_SEND");
    }

    // Teammate view → NO words, only id
    {
      const req = makeNextRequest(
        `http://localhost/api/rooms/${room.code}`,
        teammateToken,
      );
      const res = await GET(req, { params: { code: room.code } });
      expect(res.status).toBe(200);
      const json = await res.json();
      const activeCard = json.room?.round?.activeTurn?.activeCard;
      expect(activeCard?.id).toBe("card-123");
      expect(activeCard?.onePoint).toBeUndefined();
      expect(activeCard?.threePoint).toBeUndefined();
    }

    // Poet view (sanity) → placeholders present
    {
      const req = makeNextRequest(
        `http://localhost/api/rooms/${room.code}`,
        creatorToken,
      );
      const res = await GET(req, { params: { code: room.code } });
      expect(res.status).toBe(200);
      const json = await res.json();
      const activeCard = json.room?.round?.activeTurn?.activeCard;
      expect(activeCard?.onePoint).toBe("REDACTED_AT_SEND");
      expect(activeCard?.threePoint).toBe("REDACTED_AT_SEND");
    }
  });
});

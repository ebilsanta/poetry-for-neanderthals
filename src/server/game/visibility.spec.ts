import { describe, it, expect } from "vitest";
import { makeVisibleSnapshot } from "./visibility";
import { createRoom } from "@server/game/factory/createRoom";
import { getRoom, setRoom } from "@server/game/store";

function activateTurn(
  roomCode: string,
  poetId: string,
  poetTeam: "A" | "B",
  endsAt: number,
) {
  const room = getRoom(roomCode)!;

  room.currentRound = 1;
  room.rounds[1] = {
    number: 1,
    poetOrder: [poetId],
    completedTurns: [],
    activeTurnId: "t1",
  };

  room.turns["t1"] = {
    id: "t1",
    roundNumber: 1,
    poetId,
    teamId: poetTeam,
    startedAt: endsAt - 30_000,
    endsAt,
    activeCardId: "card-xyz",
    outcomes: [],
  };

  setRoom(room);
}

describe("makeVisibleSnapshot", () => {
  it("Hides words from poet's teammates, shows placeholders to poet and opponents", () => {
    const { room, player: creator } = createRoom({ name: "Creator" }); // Team A poet
    const endsAt = 1000 + 30_000;

    // Add teammate (A) and opponent (B)
    const teammateId = "p_teammate";
    const opponentId = "p_opponent";

    room.players[teammateId] = {
      id: teammateId,
      name: "Teammate",
      teamId: "A",
      isCreator: false,
      connected: true,
      tokenHash: "hash",
    };
    room.players[opponentId] = {
      id: opponentId,
      name: "Opponent",
      teamId: "B",
      isCreator: false,
      connected: true,
      tokenHash: "hash",
    };
    room.teams.A.players.push(teammateId);
    room.teams.B.players.push(opponentId);
    setRoom(room);

    activateTurn(room.code, creator.id, "A", endsAt);

    // Poet view
    {
      const snap = makeVisibleSnapshot(getRoom(room.code)!, creator.id, 1000);
      const active = snap.round?.activeTurn?.activeCard;
      expect(active?.id).toBe("card-xyz");
      expect(active?.onePoint).toBe("REDACTED_AT_SEND");
      expect(active?.threePoint).toBe("REDACTED_AT_SEND");
    }

    // Opponent view
    {
      const snap = makeVisibleSnapshot(getRoom(room.code)!, opponentId, 1000);
      const active = snap.round?.activeTurn?.activeCard;
      expect(active?.id).toBe("card-xyz");
      expect(active?.onePoint).toBe("REDACTED_AT_SEND");
      expect(active?.threePoint).toBe("REDACTED_AT_SEND");
    }

    // Teammate view
    {
      const snap = makeVisibleSnapshot(getRoom(room.code)!, teammateId, 1000);
      const active = snap.round?.activeTurn?.activeCard;
      expect(active?.id).toBe("card-xyz");
      expect(active?.onePoint).toBeUndefined();
      expect(active?.threePoint).toBeUndefined();
    }
  });

  it("Computes remainingSeconds from nowMs and endsAt", () => {
    const { room, player: creator } = createRoom({ name: "Creator" });
    const endsAt = 10_000; // absolute ms
    activateTurn(room.code, creator.id, "A", endsAt);

    // At now=1_000 → remaining = ceil((10_000-1_000)/1000) = 9
    const snapEarly = makeVisibleSnapshot(
      getRoom(room.code)!,
      creator.id,
      1_000,
    );
    expect(snapEarly.round?.activeTurn?.remainingSeconds).toBe(9);

    // At now=9_100 → remaining = ceil(900) = 1
    const snapLate = makeVisibleSnapshot(
      getRoom(room.code)!,
      creator.id,
      9_100,
    );
    expect(snapLate.round?.activeTurn?.remainingSeconds).toBe(1);

    // At now=10_500 → remaining = 0
    const snapExpired = makeVisibleSnapshot(
      getRoom(room.code)!,
      creator.id,
      10_500,
    );
    expect(snapExpired.round?.activeTurn?.remainingSeconds).toBe(0);
  });

  it("Omits activeTurn when there is no active turn", () => {
    const { room, player: creator } = createRoom({ name: "Creator" });
    // No round/turn set
    const snap = makeVisibleSnapshot(room, creator.id, Date.now());
    expect(snap.round?.activeTurn).toBeUndefined();
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

import { createRoom } from "@server/game/factory/createRoom";
import { joinRoom } from "@server/game/factory/joinRoom";
import { startFirstRound, startNextRound } from "@server/game/rounds";
import { deleteRoom } from "@server/game/store";
import type { Room } from "@server/game/types";
import { initGameServer } from "@server/game/init";

describe("round lifecycle", () => {
  let room: Room;

  beforeAll(() => {
    initGameServer();
  });

  beforeEach(() => {
    const created = createRoom({ name: "Host" });
    room = created.room;

    const join = joinRoom({ code: room.code, name: "Guest" });
    if (!join.ok) {
      throw new Error(
        `Failed to join room in test setup: ${join.error.message}`,
      );
    }
  });

  afterEach(() => {
    deleteRoom(room.code);
  });

  it("starts the first round from the lobby", () => {
    const result = startFirstRound(room);

    expect(result.ok).toBe(true);
    expect(room.state).toBe("IN_ROUND");
    expect(room.currentRound).toBe(1);

    const activeRound = room.rounds[1];
    expect(activeRound).toBeDefined();
    expect(activeRound.poetOrder.length).toBeGreaterThan(0);
    expect(room.drawPile.length).toBeGreaterThan(0);
  });

  it("rejects starting the first round when not in lobby", () => {
    room.state = "IN_ROUND";

    const result = startFirstRound(room);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_STATE");
    }
  });

  it("advances to the next round after completion", () => {
    const first = startFirstRound(room);
    if (!first.ok)
      throw new Error("Expected startFirstRound to succeed in setup");

    const currentRoundNumber = room.currentRound!;
    const currentRound = room.rounds[currentRoundNumber];
    currentRound.completedTurns = currentRound.poetOrder.slice();
    currentRound.activeTurnId = undefined;
    room.state = "BETWEEN_ROUNDS";

    const next = startNextRound(room);

    expect(next.ok).toBe(true);
    expect(room.currentRound).toBe(currentRoundNumber + 1);
    const nextRound = room.rounds[currentRoundNumber + 1];
    expect(nextRound.poetOrder.length).toBe(currentRound.poetOrder.length);
  });
});

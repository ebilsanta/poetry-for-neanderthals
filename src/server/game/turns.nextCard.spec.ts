import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

import { createRoom } from "@server/game/factory/createRoom";
import { joinRoom } from "@server/game/factory/joinRoom";
import { startFirstRound } from "@server/game/rounds";
import { startTurn } from "@server/game/turns";
import { scoreCurrentAndMaybeNextCard } from "@server/game/turns.nextCard";
import { deleteRoom } from "@server/game/store";
import type { Room } from "@server/game/types";
import { initGameServer } from "@server/game/init";

const now = () => Date.now();

describe("turn scoring flow", () => {
  let room: Room;
  let poetId: string;

  beforeAll(() => {
    initGameServer();
  });

  function setupTurn() {
    const turnResult = startTurn(room, poetId, now());
    if (!turnResult.ok) {
      throw new Error(
        `Failed to start turn in test setup: ${turnResult.error.message}`,
      );
    }
    return turnResult;
  }

  beforeEach(() => {
    const created = createRoom({ name: "Host" });
    room = created.room;
    poetId = created.player.id;

    const join = joinRoom({ code: room.code, name: "Guest" });
    if (!join.ok) {
      throw new Error(
        `Failed to join room in test setup: ${join.error.message}`,
      );
    }

    const roundResult = startFirstRound(room);
    if (!roundResult.ok) {
      throw new Error(
        `Failed to start round in test setup: ${roundResult.error.message}`,
      );
    }
  });

  afterEach(() => {
    deleteRoom(room.code);
  });

  it("scores a card and serves the next card when available", () => {
    const { turn } = setupTurn();
    const activeCardId = room.turns[turn.id].activeCardId;
    if (!activeCardId) throw new Error("Expected active card to be present");

    const result = scoreCurrentAndMaybeNextCard(room, poetId, now(), {
      cardId: activeCardId,
      outcome: "ONE",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.turnId).toBe(turn.id);
      expect(result.nextCard).toBeDefined();
      expect(result.remainingMs).toBeGreaterThanOrEqual(0);
      expect(room.turns[turn.id].outcomes).toHaveLength(1);
    }
  });

  it("ends the turn when the deck is exhausted", () => {
    const { turn } = setupTurn();
    const activeCardId = room.turns[turn.id].activeCardId;
    if (!activeCardId) throw new Error("Expected active card to be present");

    room.drawPile = [];

    const result = scoreCurrentAndMaybeNextCard(room, poetId, now(), {
      cardId: activeCardId,
      outcome: "THREE",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.turnEnded).toBeDefined();
      expect(result.turnEnded?.finalScores).toBeDefined();
      expect(room.rounds[room.currentRound!].activeTurnId).toBeUndefined();
    }
  });

  it("rejects scoring once the turn has already ended", () => {
    const { turn } = setupTurn();
    const activeCardId = room.turns[turn.id].activeCardId;
    if (!activeCardId) throw new Error("Expected active card to be present");

    room.drawPile = [];

    const firstScore = scoreCurrentAndMaybeNextCard(room, poetId, now(), {
      cardId: activeCardId,
      outcome: "ONE",
    });
    expect(firstScore.ok).toBe(true);
    if (firstScore.ok) {
      expect(firstScore.turnEnded).toBeDefined();
    }

    const secondScore = scoreCurrentAndMaybeNextCard(room, poetId, now(), {
      cardId: activeCardId,
      outcome: "ONE",
    });
    expect(secondScore.ok).toBe(false);
    if (!secondScore.ok) {
      expect(secondScore.error.code).toBe("BAD_STATE");
    }
  });
});

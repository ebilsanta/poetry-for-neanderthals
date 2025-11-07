import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

import { createRoom } from "@server/game/factory/createRoom";
import { joinRoom } from "@server/game/factory/joinRoom";
import { startFirstRound } from "@server/game/rounds";
import { startTurn } from "@server/game/turns";
import { deleteRoom } from "@server/game/store";
import type { Room } from "@server/game/types";
import { initGameServer } from "@server/game/init";

describe("turn start flow", () => {
  let room: Room;
  let hostId: string;
  let guestId: string;

  beforeAll(() => {
    initGameServer();
  });

  beforeEach(() => {
    const created = createRoom({ name: "Host" });
    room = created.room;
    hostId = created.player.id;

    const join = joinRoom({ code: room.code, name: "Guest" });
    if (!join.ok) {
      throw new Error(
        `Failed to join room in test setup: ${join.error.message}`,
      );
    }
    guestId = join.player.id;

    const firstRound = startFirstRound(room);
    if (!firstRound.ok) {
      throw new Error(
        `Failed to start first round in test setup: ${firstRound.error.message}`,
      );
    }
  });

  afterEach(() => {
    deleteRoom(room.code);
  });

  it("allows the next poet to start their turn", () => {
    const result = startTurn(room, hostId, Date.now());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const { turn } = result;
      expect(turn.poetId).toBe(hostId);
      expect(room.rounds[room.currentRound!].activeTurnId).toBe(turn.id);
      expect(room.turns[turn.id].activeCardId).toBeDefined();
    }
  });

  it("rejects players trying to start out of order", () => {
    const result = startTurn(room, guestId, Date.now());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_YOUR_TURN");
    }
  });
});

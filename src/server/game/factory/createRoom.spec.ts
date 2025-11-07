import { describe, it, expect } from "vitest";
import { createRoom } from "./createRoom";
import { VisibleRoomSnapshot } from "@lib/view/visible";

describe("createRoom", () => {
  it("creates a room with creator on Team A, MAD/GLAD defaults, and returns a visible snapshot", () => {
    const { room, player, playerToken, visibleRoom } = createRoom({
      name: "Kai",
    });

    expect(room.code).toHaveLength(3);
    expect(room.players[player.id].isCreator).toBe(true);
    expect(room.teams.A.players).toContain(player.id);
    expect(room.settings.teamNames).toEqual({ A: "MAD", B: "GLAD" });
    expect(playerToken).toMatch(/^[a-f0-9]+$/);

    // Validate wire shape with Zod (guards regressions)
    expect(() => VisibleRoomSnapshot.parse(visibleRoom)).not.toThrow();
  });

  it("overrides teamNames when provided", () => {
    const { visibleRoom } = createRoom({
      name: "Rin",
      settings: { teamNames: { A: "Sharks", B: "Jets" } },
    });
    expect(visibleRoom.settings.teamNames).toEqual({ A: "Sharks", B: "Jets" });
  });
});

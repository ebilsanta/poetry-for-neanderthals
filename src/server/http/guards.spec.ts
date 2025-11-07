import { describe, it, expect } from "vitest";
import { requireAuth } from "./guards";
import { createRoom } from "@server/game/factory/createRoom";

function makeReq(token?: string): Request {
  return new Request("http://localhost/api/rooms/XXX", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

describe("requireAuth", () => {
  it("accepts a valid token and returns playerId", () => {
    const { room, player, playerToken } = createRoom({ name: "Kai" });
    const res = requireAuth(makeReq(playerToken), room);
    if ("error" in res) throw new Error("expected success");
    expect(res.playerId).toBe(player.id);
  });

  it("rejects missing header", () => {
    const { room } = createRoom({ name: "Kai" });
    const res = requireAuth(makeReq(), room);
    expect("error" in res).toBe(true);
    if ("error" in res) {
      expect(res.status).toBe(400);
      expect(res.error.code).toBe("VALIDATION");
    }
  });

  it("rejects wrong token", () => {
    const { room } = createRoom({ name: "Kai" });
    const res = requireAuth(makeReq("not-a-real-token"), room);
    if ("error" in res) {
      expect(res.status).toBe(403);
      expect(res.error.code).toBe("FORBIDDEN");
    } else {
      throw new Error("expected failure");
    }
  });
});

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createRoom } from "@server/game/factory/createRoom";
import { getRoom, setRoom } from "@server/game/store";
import { JoinRoomRequest } from "@/lib/contracts/http/rooms.join";
import { Player } from "@/server/game/types";

function makePost(url: string, body: JoinRoomRequest) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skip("POST /api/rooms/:code/join", () => {
  it("joins an existing room, assigns to Team B (auto-balance), returns player + token", async () => {
    const { room } = createRoom({ name: "Creator" }); // Creator is on A
    const req = makePost(`http://localhost/api/rooms/${room.code}/join`, {
      name: "Newbie",
    });

    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.player?.name).toBe("Newbie");
    expect(json.player?.teamId).toBe("B");
    expect(typeof json.playerToken).toBe("string");
    expect(json.room?.players?.some((p: Player) => p.name === "Newbie")).toBe(
      true,
    );
  });

  it("returns 404 if room is not found", async () => {
    const req = makePost(`http://localhost/api/rooms/ZZZ/join`, {
      name: "Newbie",
    });
    const res = await POST(req, { params: Promise.resolve({ code: "ZZZ" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("ROOM_NOT_FOUND");
  });

  it("returns 409 if name is already taken (case-insensitive)", async () => {
    const { room } = createRoom({ name: "Alice" }); // "Alice" exists
    const req = makePost(`http://localhost/api/rooms/${room.code}/join`, {
      name: "alice",
    });
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error?.code).toBe("NAME_TAKEN");
  });

  it("returns 400 if room no longer accepts joins (not LOBBY)", async () => {
    const { room } = createRoom({ name: "Creator" });
    const r = getRoom(room.code)!;
    r.state = "IN_ROUND";
    setRoom(r);

    const req = makePost(`http://localhost/api/rooms/${room.code}/join`, {
      name: "Latecomer",
    });
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("BAD_STATE");
  });

  it("returns 400 on invalid input (empty name)", async () => {
    const { room } = createRoom({ name: "Creator" });
    const req = makePost(`http://localhost/api/rooms/${room.code}/join`, {
      name: "",
    });
    const res = await POST(req, {
      params: Promise.resolve({ code: room.code }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION");
  });
});

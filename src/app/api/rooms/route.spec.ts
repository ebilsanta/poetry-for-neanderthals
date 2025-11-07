import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { CreateRoomRequest } from "@/lib/contracts/http/rooms.create";

function makeRequest(body: CreateRoomRequest) {
  return new NextRequest("http://localhost/api/rooms", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/rooms", () => {
  it("returns 201 and a visible room snapshot", async () => {
    const req = makeRequest({ name: "Kai" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.room?.code).toHaveLength(3);
    expect(json.playerToken).toBeTruthy();
  });

  it("returns 400 on validation error", async () => {
    const req = makeRequest({ name: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error?.code).toBe("VALIDATION");
  });
});

import type { Room } from "@server/game/types";
import { verifyTokenHash } from "@server/auth/token";

/**
 * Reads Authorization: Bearer <token> from the request and verifies it belongs to a player in the room.
 * Returns { playerId } on success; otherwise an error payload with HTTP status.
 */
export function requireAuth(
  req: Request,
  room: Room,
):
  | { playerId: string }
  | {
      error: { code: "FORBIDDEN" | "VALIDATION"; message: string };
      status: number;
    } {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: {
        code: "VALIDATION",
        message: "Missing or invalid Authorization header",
      },
      status: 400,
    };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return {
      error: { code: "VALIDATION", message: "Empty bearer token" },
      status: 400,
    };
  }

  // Find player by matching token hash
  for (const p of Object.values(room.players)) {
    if (verifyTokenHash(token, p.tokenHash)) {
      return { playerId: p.id };
    }
  }

  return {
    error: { code: "FORBIDDEN", message: "Invalid token for this room" },
    status: 403,
  };
}

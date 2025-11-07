import type { Room } from "@server/game/types";
import { verifyTokenHash } from "@server/auth/token";
import type { ApiErrorCode } from "@lib/common/errors";

export type GuardErrorCode = ApiErrorCode;
export type GuardError = {
  status: number;
  error: { code: GuardErrorCode; message: string };
};

/** Bearer token → playerId in this room */
export function requireAuth(
  req: Request,
  room: Room,
): { playerId: string } | GuardError {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return {
      status: 400,
      error: {
        code: "VALIDATION",
        message: "Missing or invalid Authorization header",
      },
    };
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return {
      status: 400,
      error: { code: "VALIDATION", message: "Empty bearer token" },
    };
  }

  for (const p of Object.values(room.players)) {
    if (verifyTokenHash(token, p.tokenHash)) return { playerId: p.id };
  }
  return {
    status: 403,
    error: { code: "FORBIDDEN", message: "Invalid token for this room" },
  };
}

export function ensureCreator(
  room: Room,
  playerId: string,
): GuardError | undefined {
  if (playerId !== room.creatorId) {
    return {
      status: 403,
      error: {
        code: "FORBIDDEN",
        message: "Only the creator can perform this action",
      },
    };
  }
}

export function ensureLobby(room: Room): GuardError | undefined {
  if (room.state !== "LOBBY") {
    return {
      status: 400,
      error: {
        code: "BAD_STATE",
        message: "Settings can only be changed in the lobby",
      },
    };
  }
}

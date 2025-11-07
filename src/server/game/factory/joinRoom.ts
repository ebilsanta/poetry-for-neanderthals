import { getRoom, setRoom } from "@server/game/store";
import type { Player, Room } from "@server/game/types";
import { hashToken, generateToken } from "@server/auth/token";
import { uid } from "@server/util/id";

/**
 * Auto-balance team:
 * - choose the team with fewer players
 * - if equal, put on B (so creator on A, first join on B balances)
 */
function chooseTeam(room: Room): "A" | "B" {
  const a = room.teams.A.players.length;
  const b = room.teams.B.players.length;
  if (a < b) return "A";
  if (b < a) return "B";
  return "B";
}

/** Case-insensitive uniqueness check within a room. */
function isNameTaken(room: Room, name: string): boolean {
  const target = name.trim().toLowerCase();
  return Object.values(room.players).some(
    (p) => p.name.trim().toLowerCase() === target,
  );
}

type JoinRoomArgs = { code: string; name: string };

type JoinRoomSuccess = {
  ok: true;
  room: Room;
  player: Player;
  playerToken: string;
};

type JoinRoomFailure = {
  ok: false;
  error: { code: string; message: string };
  status: number;
};

export function joinRoom({
  code,
  name,
}: JoinRoomArgs): JoinRoomSuccess | JoinRoomFailure {
  const room = getRoom(code.toUpperCase());
  if (!room) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND" as const, message: "Room not found" },
      status: 404,
    };
  }

  if (room.state !== "LOBBY") {
    return {
      ok: false,
      error: {
        code: "BAD_STATE" as const,
        message: "Room is not accepting joins right now",
      },
      status: 400,
    };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: { code: "VALIDATION" as const, message: "Name cannot be empty" },
      status: 400,
    };
  }
  if (trimmed.length > 32) {
    return {
      ok: false,
      error: { code: "VALIDATION" as const, message: "Name too long" },
      status: 400,
    };
  }
  if (isNameTaken(room, trimmed)) {
    return {
      ok: false,
      error: {
        code: "NAME_TAKEN" as const,
        message: "Name already taken in this room",
      },
      status: 409,
    };
  }

  const playerId = uid("p_");
  const token = generateToken();
  const tokenHash = hashToken(token);
  const teamId = chooseTeam(room);

  const player: Player = {
    id: playerId,
    name: trimmed,
    teamId,
    isCreator: false,
    connected: false,
    tokenHash,
  };

  // mutate room state
  room.players[playerId] = player;
  // ensure not listed twice
  room.teams.A.players = room.teams.A.players.filter((id) => id !== playerId);
  room.teams.B.players = room.teams.B.players.filter((id) => id !== playerId);
  room.teams[teamId].players.push(playerId);

  setRoom(room);

  return {
    ok: true,
    room,
    player,
    playerToken: token,
  } as const;
}

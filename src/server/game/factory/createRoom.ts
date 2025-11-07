import type { GameSettings, Player, Room, Team } from "@server/game/types";
import { setRoom, getRoom } from "@server/game/store";
import { nowMs, uid } from "@server/util/id";
import { generateRoomCode } from "@server/util/roomCode";
import { generateToken, hashToken } from "@server/auth/token";
import { makeVisibleSnapshot } from "@server/game/visibility";

type CreateRoomArgs = {
  name: string;
  settings?: Partial<GameSettings>;
};

const DEFAULT_SETTINGS: GameSettings = {
  turnSeconds: 90,
  winningScore: 50,
  allowPass: false,
  teamNames: { A: "MAD", B: "GLAD" },
};

function generateUniqueRoomCode(): string {
  // collision-safe in-memory attempt
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    if (!getRoom(code)) return code;
  }
  return `${generateRoomCode()}${generateRoomCode()}`;
}

export function createRoom(args: CreateRoomArgs) {
  const code = generateUniqueRoomCode();
  const createdAt = nowMs();

  const teamA: Team = { id: "A", players: [], score: 0 };
  const teamB: Team = { id: "B", players: [], score: 0 };

  const playerId = uid("p_");
  const token = generateToken();
  const tokenHash = hashToken(token);

  const creator: Player = {
    id: playerId,
    name: args.name.trim(),
    teamId: "A",
    isCreator: true,
    connected: false,
    tokenHash,
  };

  const settings: GameSettings = {
    ...DEFAULT_SETTINGS,
    ...(args.settings ?? {}),
    teamNames: {
      A: args.settings?.teamNames?.A ?? DEFAULT_SETTINGS.teamNames!.A,
      B: args.settings?.teamNames?.B ?? DEFAULT_SETTINGS.teamNames!.B,
    },
  };

  const room: Room = {
    code,
    createdAt,
    creatorId: creator.id,
    state: "LOBBY",
    players: { [creator.id]: creator },
    teams: {
      A: { ...teamA, players: [creator.id] },
      B: { ...teamB, players: [] },
    },
    settings,
    drawPile: [],
    discardPile: [],
    rounds: {},
    turns: {},
  };

  setRoom(room);

  const visibleRoom = makeVisibleSnapshot(room, creator.id, createdAt);

  return {
    room,
    player: creator,
    playerToken: token,
    visibleRoom,
  };
}

import type { Room } from "@server/game/types";
import { VisibleRoomSnapshot } from "@lib/view/visible";

export function makeVisibleSnapshot(
  room: Room,
  viewerId: string,
  nowMs: number,
) {
  const players = Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    isCreator: p.isCreator,
    connected: p.connected,
  }));

  const payload = {
    code: room.code,
    state: room.state,
    settings: {
      ...room.settings,
      // ensure teamNames always present in snapshot for predictability
      teamNames: room.settings.teamNames ?? { A: "Team A", B: "Team B" },
    },
    players,
    teams: {
      A: { id: "A", players: room.teams.A.players, score: room.teams.A.score },
      B: { id: "B", players: room.teams.B.players, score: room.teams.B.score },
    },
    currentRound: room.currentRound,
    round: room.currentRound
      ? {
          number: room.currentRound,
          poetOrder: room.rounds[room.currentRound].poetOrder,
          activeTurn: undefined,
          completedTurns: room.rounds[room.currentRound].completedTurns.length,
        }
      : undefined,
  };

  // Validate against shared schema (throws if incompatible)
  return VisibleRoomSnapshot.parse(payload);
}

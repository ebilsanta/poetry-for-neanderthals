import type { Server } from "socket.io";
import type { TeamId } from "@lib/common/enums";

export const logicalRoom = {
  all: (code: string) => `room:${code}:all`,
  team: (code: string, teamId: TeamId) => `room:${code}:team:${teamId}`,
  player: (code: string, playerId: string) => `room:${code}:player:${playerId}`,
};

export function emitToEveryone<TPayload>(
  io: Server,
  roomCode: string,
  event: string,
  payload: TPayload,
) {
  io.to(logicalRoom.all(roomCode)).emit(event, payload);
}

export function emitToTeam<TPayload>(
  io: Server,
  roomCode: string,
  teamId: TeamId,
  event: string,
  payload: TPayload,
) {
  io.to(logicalRoom.team(roomCode, teamId)).emit(event, payload);
}

export function emitToPlayer<TPayload>(
  io: Server,
  roomCode: string,
  playerId: string,
  event: string,
  payload: TPayload,
) {
  io.to(logicalRoom.player(roomCode, playerId)).emit(event, payload);
}

function opposingTeam(teamId: TeamId): TeamId {
  return teamId === "A" ? "B" : "A";
}

export function emitCardVisibility<TWords, TPlaceholder>(
  io: Server,
  roomCode: string,
  poetPlayerId: string,
  poetTeamId: TeamId,
  event: string,
  payloads: { words: TWords; placeholder: TPlaceholder },
) {
  const playerRoom = logicalRoom.player(roomCode, poetPlayerId);
  const poetTeamRoom = logicalRoom.team(roomCode, poetTeamId);
  const opponentTeamRoom = logicalRoom.team(roomCode, opposingTeam(poetTeamId));

  io.to(playerRoom).emit(event, payloads.words);

  io.to(opponentTeamRoom).emit(event, payloads.words);

  io.to(poetTeamRoom).except(playerRoom).emit(event, payloads.placeholder);
}

export function emitRoundEnded(io: Server, roomCode: string, payload: unknown) {
  io.to(logicalRoom.all(roomCode)).emit("rounds:ended", payload);
}

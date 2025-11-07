import type { TeamId, RoomState, Outcome } from "@lib/common/enums";

export type RoomCode = string; // 3 chars
export type ISOEpochMs = number;

export interface Player {
  id: string;
  name: string; // unique per room
  teamId: TeamId;
  isCreator: boolean;
  connected: boolean;
  // server-only secrets/infra
  tokenHash: string;
  socketId?: string;
}

export interface Team {
  id: TeamId;
  players: string[]; // playerIds
  score: number;
}

export interface Card {
  id: string;
  onePoint: string;
  threePoint: string;
  used: boolean;
}

export interface RawCard {
  id: string;
  onePoint: string;
  threePoint: string;
}

export interface TurnOutcome {
  cardId: string;
  outcome: Outcome;
  timestamp: ISOEpochMs;
}

export interface Turn {
  id: string;
  roundNumber: number;
  poetId: string;
  teamId: TeamId;
  startedAt?: ISOEpochMs;
  endsAt?: ISOEpochMs;
  timerRemaining?: number;
  activeCardId?: string;
  outcomes: TurnOutcome[];
  endedReason?: "TIMER" | "MANUAL";
}

export interface Round {
  number: number;
  poetOrder: string[]; // playerIds
  completedTurns: string[]; // turnIds
  activeTurnId?: string;
}

export interface GameSettings {
  turnSeconds: number;
  winningScore?: number;
  allowPass?: boolean;
  teamNames?: Record<TeamId, string>; // { A : "MAD", B : "GLAD"}
}

export interface Room {
  code: RoomCode;
  createdAt: ISOEpochMs;
  creatorId: string;
  state: RoomState;

  players: Record<string, Player>;
  teams: { A: Team; B: Team };

  settings: GameSettings;

  drawPile: string[]; // cardIds
  discardPile: string[];

  rounds: Record<number, Round>;
  currentRound?: number;

  turns: Record<string, Turn>; // authoritative turn storage
}

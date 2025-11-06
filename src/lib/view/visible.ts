import { z } from "zod";
import { TeamId, RoomState } from "@lib/common/enums";

export const VisibleCard = z.object({
  id: z.string(),
  onePoint: z.string().optional(), // present only for poet/opponents
  threePoint: z.string().optional(), // present only for poet/opponents
});
export type VisibleCard = z.infer<typeof VisibleCard>;

export const VisibleTurn = z.object({
  id: z.string(),
  roundNumber: z.number(),
  poetId: z.string(),
  teamId: TeamId,
  startedAt: z.number().optional(),
  endsAt: z.number().optional(),
  remainingSeconds: z.number().optional(),
  activeCard: VisibleCard.optional(),
  outcomesCount: z.object({
    ONE: z.number(),
    THREE: z.number(),
    PENALTY: z.number(),
  }),
});
export type VisibleTurn = z.infer<typeof VisibleTurn>;

export const VisibleRoomSnapshot = z.object({
  code: z.string(),
  state: RoomState,
  settings: z.object({
    turnSeconds: z.number(),
    winningScore: z.number().optional(),
    allowPass: z.boolean().optional(),
  }),
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      teamId: TeamId,
      isCreator: z.boolean(),
      connected: z.boolean(),
    }),
  ),
  teams: z.object({
    A: z.object({
      id: TeamId,
      players: z.array(z.string()),
      score: z.number(),
    }),
    B: z.object({
      id: TeamId,
      players: z.array(z.string()),
      score: z.number(),
    }),
  }),
  currentRound: z.number().optional(),
  round: z
    .object({
      number: z.number(),
      poetOrder: z.array(z.string()),
      activeTurn: VisibleTurn.optional(),
      completedTurns: z.number(),
    })
    .optional(),
  lastTurnSummary: z
    .object({
      turnId: z.string(),
      teamDelta: z.record(TeamId, z.number()),
      finalScores: z.record(TeamId, z.number()),
    })
    .optional(),
});
export type VisibleRoomSnapshot = z.infer<typeof VisibleRoomSnapshot>;

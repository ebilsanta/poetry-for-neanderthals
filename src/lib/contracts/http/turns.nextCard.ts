import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { TeamId } from "@lib/common/enums";
import { ApiErrorSchema } from "@lib/common/errors";

export const NextCardRequest = z.object({
  cardId: z.string(),
  outcome: z.enum(["ONE", "THREE", "PENALTY"]),
});
export type NextCardRequest = z.infer<typeof NextCardRequest>;

export const NextCardResponse = z
  .object({
    turnId: z.string(),

    // Updated cumulative total scores after applying the outcome
    scores: z.record(TeamId, z.number()),

    // Score delta *only* from the card just scored (ex: { A: +3, B: 0 })
    lastCardDelta: z.record(TeamId, z.number()),

    /**
     * --- CASE A: turn continues ---
     * nextCard + remainingMs included
     */
    nextCard: z
      .object({
        id: z.string(),
        onePoint: z.string(),
        threePoint: z.string(),
      })
      .optional(),
    remainingMs: z.number().optional(),

    /**
     * --- CASE B: turn ended ---
     * (timer expired or deck exhausted)
     */
    turnEnded: z
      .object({
        teamDelta: z.record(TeamId, z.number()), // score change this turn only
        wordsPlayed: z.array(
          z.object({
            cardId: z.string(),
            outcome: z.enum(["ONE", "THREE", "PENALTY"]),
          })
        ),
        finalScores: z.record(TeamId, z.number()),
      })
      .optional(),

    room: z.object(VisibleRoomSnapshot.shape),
  })
  .or(ApiErrorSchema);

export type NextCardResponse = z.infer<typeof NextCardResponse>;

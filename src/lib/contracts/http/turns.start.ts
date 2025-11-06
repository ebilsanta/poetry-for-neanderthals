import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { TeamId } from "@lib/common/enums";
import { ApiErrorSchema } from "@lib/common/errors";

export const StartTurnRequest = z.object({}).optional();
export type StartTurnRequest = z.infer<typeof StartTurnRequest>;

export const StartTurnResponse = z
  .object({
    turn: z.object({
      id: z.string(),
      poetId: z.string(),
      teamId: TeamId,
      startedAt: z.number(),
      endsAt: z.number(),
    }),
    // Card words only included by server for poet & opponents (audience-filtered)
    card: z
      .object({ id: z.string(), onePoint: z.string(), threePoint: z.string() })
      .optional(),
    room: { ...VisibleRoomSnapshot.shape },
  })
  .or(ApiErrorSchema);
export type StartTurnResponse = z.infer<typeof StartTurnResponse>;

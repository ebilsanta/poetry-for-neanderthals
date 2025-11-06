import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { TeamId } from "@lib/common/enums";
import { ApiErrorSchema } from "@lib/common/errors";

export const AssignPlayersRequest = z.object({
  moves: z
    .array(
      z.object({
        playerId: z.string().min(1),
        teamId: TeamId,
      }),
    )
    .min(1, "Provide at least one move."),
});
export type AssignPlayersRequest = z.infer<typeof AssignPlayersRequest>;

export const AssignPlayersResponse = z
  .object({
    room: z.object(VisibleRoomSnapshot.shape),
    meta: z
      .object({
        reassigned: z
          .array(
            z.object({
              playerId: z.string(),
              teamId: TeamId,
            }),
          )
          .optional(),
      })
      .optional(),
  })
  .or(ApiErrorSchema);
export type AssignPlayersResponse = z.infer<typeof AssignPlayersResponse>;

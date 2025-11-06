import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { ApiErrorSchema } from "@lib/common/errors";
import { RoomState } from "@lib/common/enums";

export const NextRoundRequest = z.object({}).optional();
export type NextRoundRequest = z.infer<typeof NextRoundRequest>;

export const NextRoundResponse = z
  .object({
    round: z.object({
      number: z.number(),
      poetOrder: z.array(z.string()),
      activeTurnId: z.string().optional(),
    }),
    roomState: RoomState, // 'IN_ROUND' or 'ENDED'
    room: VisibleRoomSnapshot,
  })
  .or(ApiErrorSchema);
export type NextRoundResponse = z.infer<typeof NextRoundResponse>;

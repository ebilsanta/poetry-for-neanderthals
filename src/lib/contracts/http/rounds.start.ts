import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { ApiErrorSchema } from "@lib/common/errors";
import { RoomState } from "@lib/common/enums";

export const StartRoundRequest = z.object({}).optional(); // no body
export type StartRoundRequest = z.infer<typeof StartRoundRequest>;

export const StartRoundResponse = z
  .object({
    round: z.object({
      number: z.number(),
      poetOrder: z.array(z.string()),
      activeTurnId: z.string().optional(),
    }),
    roomState: RoomState,
    room: VisibleRoomSnapshot,
  })
  .or(ApiErrorSchema);
export type StartRoundResponse = z.infer<typeof StartRoundResponse>;

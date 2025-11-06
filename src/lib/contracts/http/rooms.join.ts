import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { TeamId } from "@lib/common/enums";
import { ApiErrorSchema } from "@lib/common/errors";

export const JoinRoomRequest = z.object({
  name: z.string().min(1).max(32),
});
export type JoinRoomRequest = z.infer<typeof JoinRoomRequest>;

export const JoinRoomResponse = z
  .object({
    room: VisibleRoomSnapshot,
    player: z.object({
      id: z.string(),
      name: z.string(),
      teamId: TeamId,
      isCreator: z.boolean(),
    }),
    playerToken: z.string(),
  })
  .or(ApiErrorSchema);
export type JoinRoomResponse = z.infer<typeof JoinRoomResponse>;

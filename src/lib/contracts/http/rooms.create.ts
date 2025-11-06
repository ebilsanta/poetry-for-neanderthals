import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { TeamId } from "@lib/common/enums";
import { ApiErrorSchema } from "@lib/common/errors";

export const CreateRoomRequest = z.object({
  name: z.string().min(1).max(32),
  settings: z
    .object({
      turnSeconds: z.number().int().min(10).max(600).optional(),
      winningScore: z.number().int().min(1).max(999).optional(),
      allowPass: z.boolean().optional(),
    })
    .optional(),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequest>;

export const CreateRoomResponse = z
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
export type CreateRoomResponse = z.infer<typeof CreateRoomResponse>;

import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { ApiErrorSchema } from "@lib/common/errors";

export const GetRoomResponse = z
  .object({
    room: VisibleRoomSnapshot.pick({
      code: true,
      state: true,
    }),
  })
  .or(ApiErrorSchema);
export type GetRoomResponse = z.infer<typeof GetRoomResponse>;

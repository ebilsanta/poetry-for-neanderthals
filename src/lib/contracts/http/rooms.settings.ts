import { z } from "zod";
import { VisibleRoomSnapshot } from "@lib/view/visible";
import { ApiErrorSchema } from "@lib/common/errors";

export const UpdateSettingsRequest = z.object({
  settings: z
    .object({
      turnSeconds: z.number().int().min(10).max(600).optional(),
      winningScore: z.number().int().min(1).max(999).optional(),
      allowPass: z.boolean().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "At least one setting must be provided.",
    }),
});
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequest>;

export const UpdateSettingsResponse = z
  .object({
    room: z.object(VisibleRoomSnapshot.shape),
    meta: z
      .object({
        updatedSettings: z.array(z.string()).optional(), // e.g., ["turnSeconds","winningScore"]
      })
      .optional(),
  })
  .or(ApiErrorSchema);
export type UpdateSettingsResponse = z.infer<typeof UpdateSettingsResponse>;

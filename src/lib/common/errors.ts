import { z } from "zod";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "ROOM_NOT_FOUND",
      "ROOM_EXPIRED",
      "NAME_TAKEN",
      "FORBIDDEN",
      "BAD_STATE",
      "NOT_YOUR_TURN",
      "VALIDATION",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

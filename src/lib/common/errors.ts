import { z } from "zod";

export const ApiErrorCode = z.enum([
  "ROOM_NOT_FOUND",
  "ROOM_EXPIRED",
  "NAME_TAKEN",
  "FORBIDDEN",
  "BAD_STATE",
  "NOT_YOUR_TURN",
  "VALIDATION",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

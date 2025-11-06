import { z } from "zod";

export const TeamId = z.enum(["A", "B"]);
export type TeamId = z.infer<typeof TeamId>;

export const RoomState = z.enum(["LOBBY", "IN_ROUND", "BETWEEN_ROUNDS", "ENDED"]);
export type RoomState = z.infer<typeof RoomState>;

export const Outcome = z.enum(["ONE", "THREE", "PENALTY"]);
export type Outcome = z.infer<typeof Outcome>;

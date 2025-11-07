import type { Outcome, TeamId } from "@lib/common/enums";

export function scoreDeltaForOutcome(
  team: TeamId,
  outcome: Outcome,
): Record<TeamId, number> {
  // ONE and THREE add to poet's team; PENALTY adds +1 to opposing team
  if (outcome === "ONE")
    return { A: team === "A" ? +1 : 0, B: team === "B" ? +1 : 0 };
  if (outcome === "THREE")
    return { A: team === "A" ? +3 : 0, B: team === "B" ? +3 : 0 };
  // PENALTY
  return { A: team === "A" ? 0 : +1, B: team === "B" ? 0 : +1 };
}

export function sumTurnDelta(
  outcomes: { outcome: Outcome }[],
  poetTeam: TeamId,
) {
  let dA = 0,
    dB = 0;
  for (const o of outcomes) {
    const d = scoreDeltaForOutcome(poetTeam, o.outcome);
    dA += d.A;
    dB += d.B;
  }
  return { A: dA, B: dB } as Record<TeamId, number>;
}

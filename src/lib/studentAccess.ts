/** Shared UI guards; on-chain StudentRegistry and budget checks remain authoritative. */
export function studentCanParticipate(connected: boolean, student: boolean, registryMatches: boolean): boolean {
  return connected && student && registryMatches;
}
export function remainingBudget(maxPerRound: bigint, spent: bigint): bigint {
  return spent >= maxPerRound ? 0n : maxPerRound - spent;
}
export function donationLimit(amount: bigint, min: bigint, maxProject: bigint, donatedToProject: bigint, roundRemaining: bigint): "minimum" | "project" | "round" | null {
  if (amount < min) return "minimum";
  if (donatedToProject + amount > maxProject) return "project";
  if (amount > roundRemaining) return "round";
  return null;
}

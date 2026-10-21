export const FINALIZE_GRACE = 86_400n;
export type RoundPhase = "notStarted" | "open" | "endedGrace" | "endedOpenToAll" | "finalized" | "cancelled";
export type PhaseRound = {
  startTime?: bigint | number; endTime?: bigint | number;
  finalized?: boolean; isCancelled?: boolean;
};

function timestamp(value: bigint | number | undefined): bigint | undefined {
  if (typeof value === "bigint") return value >= 0n ? value : undefined;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : undefined;
}

/** Missing legacy timestamps never imply the round can be finalized. */
export function deriveRoundPhase(round: PhaseRound, nowSeconds: number | bigint): RoundPhase {
  if (round.isCancelled) return "cancelled";
  if (round.finalized) return "finalized";
  const now = timestamp(nowSeconds), start = timestamp(round.startTime), end = timestamp(round.endTime);
  if (now === undefined) return "notStarted";
  if (start !== undefined && now < start) return "notStarted";
  if (end !== undefined && now >= end) return now < end + FINALIZE_GRACE ? "endedGrace" : "endedOpenToAll";
  return start !== undefined || end !== undefined ? "open" : "notStarted";
}

export type ActionRound = PhaseRound & {
  roundAddress?: string; admin?: string; supportsPhase2?: boolean;
  leftover?: bigint; leftoverWithdrawn?: boolean; cancelledPoolWithdrawn?: boolean;
  isLoading?: boolean; isError?: boolean; depositSupported?: boolean;
};
export function deriveRoundActions(round: ActionRound, nowSeconds: number | bigint, viewer?: string) {
  const phase = deriveRoundPhase(round, nowSeconds);
  const lifecycleReadable = typeof round.finalized === "boolean" && (round.supportsPhase2 !== true || typeof round.isCancelled === "boolean");
  const ready = Boolean(round.roundAddress && viewer && lifecycleReadable && !round.isLoading && !round.isError);
  const isAdmin = Boolean(ready && round.admin && viewer!.toLowerCase() === round.admin.toLowerCase());
  const active = phase !== "finalized" && phase !== "cancelled";
  const end = timestamp(round.endTime), start = timestamp(round.startTime), now = timestamp(nowSeconds);
  const validSchedule = end !== undefined && (start === undefined || start <= end);
  return {
    phase, isAdmin,
    finalize: ready && validSchedule && now !== undefined && now > 0n && (phase === "endedOpenToAll" || (phase === "endedGrace" && isAdmin)),
    deposit: isAdmin && active && round.depositSupported !== false,
    cancel: isAdmin && active && round.supportsPhase2 === true,
    withdrawLeftover: isAdmin && phase === "finalized" && typeof round.leftover === "bigint" && round.leftover > 0n && round.leftoverWithdrawn === false,
    withdrawPool: isAdmin && phase === "cancelled" && round.supportsPhase2 === true && round.cancelledPoolWithdrawn === false,
  };
}

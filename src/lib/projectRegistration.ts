import type { Address } from "viem";
import type { RoundFields } from "./contracts/roundReads";

export type RegistrationRoundState = "loading" | "error" | "open" | "closed" | "incompatible";

/** Registration is allowed before donations start, but never at/after endTime. */
export function registrationRoundState(fields: RoundFields | undefined, now: number, registry: Address): RegistrationRoundState {
  if (!fields || now <= 0) return "loading";
  const endTime = fields.results[3]?.result;
  const finalized = fields.results[8]?.result;
  const cancellation = fields.results[15];
  if (fields.results.slice(0, 12).some(result => result.status === "failure")
    || typeof endTime !== "bigint" || typeof finalized !== "boolean"
    || (cancellation?.status !== "success" && cancellation?.status !== "skipped")) return "error";
  if (finalized || cancellation.result === true || BigInt(now) >= endTime) return "closed";
  if (!fields.registry || fields.registry.toLowerCase() !== registry.toLowerCase()) return "incompatible";
  return "open";
}

export function selectRegistrationRound<T extends { address: Address; state: RegistrationRoundState }>(rounds: T[], selection?: string) {
  // An invalid/expired explicit choice must never silently send to a different round.
  return selection !== undefined
    ? rounds.find(round => round.address.toLowerCase() === selection.toLowerCase() && round.state === "open")
    : rounds.find(round => round.state === "open");
}

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

/** State comes only from contract reads and the latest on-chain admin decision. */
export function verificationStatus(whitelisted: boolean, requested: boolean, latestDecision?: boolean): VerificationStatus {
  if (whitelisted) return "approved";
  if (requested) return "pending";
  return latestDecision === false ? "rejected" : "none";
}

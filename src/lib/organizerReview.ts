export type OrganizerReview = {
  id: string;
  status: "approved" | "rejected" | "revoked";
  txHash?: string | null;
  revocationReason?: string | null;
  reviewedBy: string;
  expectedUpdatedAt: string;
  issuedAt: number;
};

/** A readable signature binds the Admin to one decision and one application revision. */
export function organizerReviewMessage(review: OrganizerReview, factory: string, chainId: number) {
  const lines = [
    "SqrtFund: Review Organizer Application",
    `Chain ID: ${chainId}`,
    `Factory: ${factory.toLowerCase()}`,
    `Application: ${review.id}`,
    `Decision: ${review.status}`,
    `Transaction: ${review.txHash ?? "none"}`,
    `Reviewer: ${review.reviewedBy.toLowerCase()}`,
    `Application version: ${review.expectedUpdatedAt}`,
    `Issued at: ${review.issuedAt}`,
  ];
  if (review.status === "revoked" && review.revocationReason) {
    lines.push(`Revocation reason: ${review.revocationReason}`);
  }
  return lines.join("\n");
}

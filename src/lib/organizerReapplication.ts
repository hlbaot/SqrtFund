export type OrganizerReapplication = {
  walletAddress: string;
  organizationName: string;
  contactEmail: string;
  reason: string;
  applicationId: string;
  expectedUpdatedAt: string;
  issuedAt: number;
};

export function organizerReapplicationMessage(input: OrganizerReapplication, factory: string, chainId: number) {
  return "SqrtFund: Reapply for Organizer access\n" + JSON.stringify({
    chainId, factory: factory.toLowerCase(), walletAddress: input.walletAddress.toLowerCase(),
    applicationId: input.applicationId, expectedUpdatedAt: input.expectedUpdatedAt,
    organizationName: input.organizationName.trim(), contactEmail: input.contactEmail.trim().toLowerCase(),
    reason: input.reason.trim(), issuedAt: input.issuedAt,
  });
}

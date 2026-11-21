export const ORGANIZER_READ_TTL_MS = 15 * 60_000;

export type OrganizerReadPermit = {
  walletAddress: string;
  origin: string;
  factory: string;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

/** Credential READ ngắn hạn, dùng lại được; không đưa chữ ký vào URL/storage. */
export function organizerReadMessage(permit: OrganizerReadPermit) {
  return [
    "SqrtFund: Read Organizer applications",
    "Allow reading my applications. If I am the current Factory owner, allow reading all applications.",
    "This signature does not authorize transactions or changes to applications.",
    `Origin: ${permit.origin}`,
    `Wallet: ${permit.walletAddress.toLowerCase()}`,
    `Factory: ${permit.factory.toLowerCase()}`,
    `Chain ID: ${permit.chainId}`,
    `Issued at: ${permit.issuedAt}`,
    `Expires at: ${permit.expiresAt}`,
    `Nonce: ${permit.nonce}`,
  ].join("\n");
}

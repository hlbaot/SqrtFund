import { normalizeEmail } from "@/lib/verify/domain";

export const EMAIL_WALLET_PROOF_TTL_MS = 10 * 60_000;
export type EmailWalletPurpose = "student" | "organizer";
export type EmailWalletPermit = {
  purpose: EmailWalletPurpose;
  email: string;
  wallet: string;
  origin: string;
  deployment: string;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
export type EmailWalletProof = EmailWalletPermit & { signature: `0x${string}` };
export function emailWalletMessage(p: EmailWalletPermit) {
  return [
    "SqrtFund: Verify wallet for email binding",
    "I authorize linking this email identity to my wallet after email verification.",
    "This signature does not authorize a transaction or transfer funds.",
    `Purpose: ${p.purpose}`,
    `Email identity: ${p.email}`,
    `Wallet: ${p.wallet.toLowerCase()}`,
    `Origin: ${p.origin}`,
    `Deployment: ${p.deployment.toLowerCase()}`,
    `Chain ID: ${p.chainId}`,
    `Issued at: ${p.issuedAt}`,
    `Expires at: ${p.expiresAt}`,
    `Nonce: ${p.nonce}`,
  ].join("\n");
}
/** Memory only. Reusable for this email/wallet/purpose until expiry; OTPs remain single-use. */
export function createEmailWalletPermit(
  purpose: EmailWalletPurpose,
  email: string,
  wallet: string,
  deployment: string,
): EmailWalletPermit {
  const issuedAt = Date.now();
  return {
    purpose,
    email: normalizeEmail(email),
    wallet: wallet.toLowerCase(),
    deployment: deployment.toLowerCase(),
    origin: window.location.origin,
    chainId: 43113,
    issuedAt,
    expiresAt: issuedAt + EMAIL_WALLET_PROOF_TTL_MS,
    nonce: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

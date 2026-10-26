import "server-only";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import {
  EMAIL_WALLET_PROOF_TTL_MS,
  emailWalletMessage,
  type EmailWalletPermit,
  type EmailWalletPurpose,
} from "@/lib/emailWalletProof";
import { normalizeEmail } from "@/lib/verify/domain";
import { VerificationError } from "@/lib/verify/errors";

/** Verify before consuming OTPs or writing a durable identity. Never log the proof. */
export async function authorizeEmailWallet(
  request: Request,
  proof: unknown,
  email: string,
  wallet: string,
  purpose: EmailWalletPurpose,
): Promise<void> {
  const invalid = () => new VerificationError("WALLET_PROOF_INVALID", 401);
  if (!proof || typeof proof !== "object" || Array.isArray(proof))
    throw new VerificationError("WALLET_PROOF_REQUIRED", 401);
  const p = proof as Record<string, unknown>;
  const now = Date.now();
  const deployment =
    purpose === "student"
      ? process.env.NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS
      : process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (
    !deployment ||
    !isAddress(deployment) ||
    Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113
  )
    throw new VerificationError("CONFIG_MISSING", 503);
  if (
    p.purpose !== purpose ||
    p.email !== normalizeEmail(email) ||
    p.wallet !== wallet.toLowerCase() ||
    !isAddress(wallet) ||
    p.origin !== new URL(request.url).origin ||
    typeof p.deployment !== "string" ||
    p.deployment !== deployment.toLowerCase() ||
    p.chainId !== 43113 ||
    typeof p.issuedAt !== "number" ||
    !Number.isSafeInteger(p.issuedAt) ||
    typeof p.expiresAt !== "number" ||
    !Number.isSafeInteger(p.expiresAt) ||
    p.issuedAt > now + 30_000 ||
    p.expiresAt <= now ||
    p.expiresAt - p.issuedAt !== EMAIL_WALLET_PROOF_TTL_MS ||
    typeof p.nonce !== "string" ||
    !/^[a-f0-9]{32}$/.test(p.nonce) ||
    typeof p.signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(p.signature)
  )
    throw invalid();
  // Current Core EOA flow. Contract-wallet signatures require a future ERC-1271 verifier.
  try {
    if (
      !(await verifyMessage({
        address: wallet as Address,
        message: emailWalletMessage(p as unknown as EmailWalletPermit),
        signature: p.signature as Hex,
      }))
    )
      throw invalid();
  } catch {
    throw invalid();
  }
}

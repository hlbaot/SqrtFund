import "server-only";
import { createPublicClient, http, isAddress, isHash, isHex, type Hex } from "viem";
import { avalancheFuji } from "viem/chains";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { organizerReviewMessage, type OrganizerReview } from "@/lib/organizerReview";
import { VerificationError } from "@/lib/verify/errors";

export async function authorizeOrganizerReview(body: Record<string, unknown>): Promise<OrganizerReview> {
  const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);
  if (!isAddress(factory ?? "") || chainId !== 43113) throw new VerificationError("CONFIG_MISSING", 503);
  if (typeof body.id !== "string" || !body.id || body.id.length > 200 || /[\r\n]/.test(body.id)
    || (body.status !== "approved" && body.status !== "rejected" && body.status !== "revoked")
    || typeof body.reviewedBy !== "string" || !isAddress(body.reviewedBy)
    || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)) || /[\r\n]/.test(body.expectedUpdatedAt)
    || typeof body.issuedAt !== "number" || !Number.isSafeInteger(body.issuedAt)
    || typeof body.signature !== "string" || !isHex(body.signature)
    || (body.txHash != null && (typeof body.txHash !== "string" || !isHash(body.txHash)))) {
    throw new VerificationError("ADMIN_SIGNATURE_REQUIRED", 403);
  }
  if (body.issuedAt > Date.now() + 30_000 || Date.now() - body.issuedAt > 300_000) throw new VerificationError("ADMIN_SIGNATURE_EXPIRED", 403);
  const review = body as unknown as OrganizerReview;
  const client = createPublicClient({ chain: avalancheFuji, transport: http(process.env.NEXT_PUBLIC_RPC_URL, { timeout: 10_000, retryCount: 1 }) });
  try {
    if (await client.getChainId() !== chainId) throw new VerificationError("RPC_CHAIN_MISMATCH", 503);
    const owner = await client.readContract({ address: factory as `0x${string}`, abi: roundFactoryAbi, functionName: "owner" });
    if (review.reviewedBy.toLowerCase() !== owner.toLowerCase()) throw new VerificationError("PLATFORM_OWNER_ONLY", 403);
    const valid = await client.verifyMessage({ address: owner, message: organizerReviewMessage(review, factory!, chainId), signature: body.signature as Hex });
    if (!valid) throw new VerificationError("PLATFORM_OWNER_ONLY", 403);
    return review;
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError("ADMIN_AUTHORIZATION_UNAVAILABLE", 503);
  }
}

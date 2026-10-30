import "server-only";
import { createPublicClient, http, isAddress, parseEventLogs, verifyMessage, type Address, type Hex } from "viem";
import { avalancheFuji } from "viem/chains";
import { qfRoundAbi, roundFactoryAbi } from "@/lib/contracts/abis";
import { PROFILE_TTL, type ProfilePermit } from "@/lib/projectProfile";
import { governanceMessage, type GovernanceChange } from "@/lib/roundGovernance";
import { VerificationError } from "@/lib/verify/errors";
export async function governanceChain(round: string) {
  const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factory || !isAddress(factory)) throw new VerificationError("GOVERNANCE_UNAVAILABLE", 503);
  const client = createPublicClient({ chain: avalancheFuji, transport: http(process.env.NEXT_PUBLIC_RPC_URL, { timeout: 10000, retryCount: 1 }) });
  if (await client.getChainId() !== 43113) throw new VerificationError("GOVERNANCE_UNAVAILABLE", 503);
  const rounds = await client.readContract({ address: factory, abi: roundFactoryAbi, functionName: "getRounds" });
  if (!rounds.some(r => r.toLowerCase() === round)) throw new VerificationError("ROUND_NOT_FOUND", 404);
  return client;
}
export async function authorizeGovernance(request: Request, change: GovernanceChange, permit: ProfilePermit, signature: unknown, transactionHash: unknown) {
  const invalid = () => new VerificationError("GOVERNANCE_AUTH_INVALID", 401);
  const now = Date.now();
  if (!permit || typeof permit.wallet !== "string" || !isAddress(permit.wallet) || permit.origin !== new URL(request.url).origin || permit.chainId !== 43113 || !Number.isSafeInteger(permit.issuedAt) || !Number.isSafeInteger(permit.expiresAt) || permit.issuedAt > now + 30000 || permit.expiresAt <= now || permit.expiresAt - permit.issuedAt !== PROFILE_TTL || typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw invalid();
  let valid = false;
  try { valid = await verifyMessage({ address: permit.wallet as Address, message: governanceMessage(change, permit), signature: signature as Hex }); } catch {}
  if (!valid) throw invalid();
  const client = await governanceChain(change.round);
  const address = change.round as Address;
  const admin = await client.readContract({ address, abi: qfRoundAbi, functionName: "admin" });
  if (admin.toLowerCase() !== permit.wallet.toLowerCase()) throw new VerificationError("GOVERNANCE_FORBIDDEN", 403);
  if (change.kind === "policy") {
    const [count, end, finalized, cancelled, block] = await Promise.all([
      client.readContract({ address, abi: qfRoundAbi, functionName: "projectCount" }),
      client.readContract({ address, abi: qfRoundAbi, functionName: "endTime" }),
      client.readContract({ address, abi: qfRoundAbi, functionName: "finalized" }),
      client.readContract({ address, abi: qfRoundAbi, functionName: "isCancelled" }),
      client.getBlock(),
    ]);
    if (count !== 0n || finalized || cancelled || block.timestamp >= end) throw new VerificationError("POLICY_LOCKED", 409);
  } else {
    if (typeof transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) throw new VerificationError("REVIEW_RECEIPT_REQUIRED", 400);
    const receipt = await client.getTransactionReceipt({ hash: transactionHash as Hex });
    const eventName = change.review.action === "approve" ? "ProjectApproved" : "ProjectRejected";
    if (receipt.status !== "success" || receipt.from.toLowerCase() !== admin.toLowerCase() || receipt.to?.toLowerCase() !== change.round) throw new VerificationError("REVIEW_RECEIPT_INVALID", 400);
    const events = parseEventLogs({ abi: qfRoundAbi, eventName, logs: receipt.logs.filter(log => log.address.toLowerCase() === change.round) });
    if (!events.some(e => e.args.id === BigInt(change.review.projectId))) throw new VerificationError("REVIEW_RECEIPT_INVALID", 400);
  }
  return permit.wallet.toLowerCase();
}

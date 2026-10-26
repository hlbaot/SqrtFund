import "server-only";
import { createPublicClient, http, isAddress, isHex, type Address, type Hex } from "viem";
import { avalancheFuji } from "viem/chains";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { ORGANIZER_READ_TTL_MS, organizerReadMessage, type OrganizerReadPermit } from "@/lib/organizerReadAccess";
import { VerificationError } from "@/lib/verify/errors";

/** Authorize before touching application data. A query wallet is a filter, never identity. */
export async function authorizeOrganizerRead(request: Request, requestedWallet?: string): Promise<void> {
  const header = request.headers.get("authorization");
  if (!header) throw new VerificationError("ORGANIZER_READ_AUTH_REQUIRED", 401);
  if (header.length > 4096 || !/^Bearer [A-Za-z0-9+/]+={0,2}$/.test(header))
    throw new VerificationError("ORGANIZER_READ_AUTH_INVALID", 401);

  let value: Record<string, unknown>;
  try {
    value = JSON.parse(Buffer.from(header.slice(7), "base64").toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid credential");
  } catch { throw new VerificationError("ORGANIZER_READ_AUTH_INVALID", 401); }

  const now = Date.now();
  if (typeof value.walletAddress !== "string" || !isAddress(value.walletAddress)
    || typeof value.signature !== "string" || !isHex(value.signature) || value.signature.length < 4
    || typeof value.origin !== "string" || value.origin !== new URL(request.url).origin
    || typeof value.factory !== "string" || !isAddress(value.factory)
    || value.chainId !== 43113
    || typeof value.issuedAt !== "number" || !Number.isSafeInteger(value.issuedAt)
    || typeof value.expiresAt !== "number" || !Number.isSafeInteger(value.expiresAt)
    || value.issuedAt > now + 30_000 || value.expiresAt <= now
    || value.expiresAt - value.issuedAt !== ORGANIZER_READ_TTL_MS
    || typeof value.nonce !== "string" || !/^[a-f0-9]{32}$/.test(value.nonce))
    throw new VerificationError("ORGANIZER_READ_AUTH_INVALID", 401);

  const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!isAddress(factory ?? "") || Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113)
    throw new VerificationError("CONFIG_MISSING", 503);
  if (value.factory.toLowerCase() !== factory!.toLowerCase())
    throw new VerificationError("ORGANIZER_READ_AUTH_INVALID", 401);

  const permit = value as unknown as OrganizerReadPermit;
  const client = createPublicClient({ chain: avalancheFuji,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL, { timeout: 10_000, retryCount: 1 }) });
  try {
    if (await client.getChainId() !== 43113) throw new VerificationError("RPC_CHAIN_MISMATCH", 503);
    const valid = await client.verifyMessage({ address: permit.walletAddress as Address,
      message: organizerReadMessage(permit), signature: value.signature as Hex });
    if (!valid) throw new VerificationError("ORGANIZER_READ_AUTH_INVALID", 401);
    if (requestedWallet?.toLowerCase() === permit.walletAddress.toLowerCase()) return;
    // No cached owner role: ownership changes take effect on the next read.
    const owner = await client.readContract({ address: factory as Address, abi: roundFactoryAbi, functionName: "owner" });
    if (owner.toLowerCase() !== permit.walletAddress.toLowerCase())
      throw new VerificationError("ORGANIZER_READ_FORBIDDEN", 403);
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError("ORGANIZER_READ_AUTH_UNAVAILABLE", 503);
  }
}

import "server-only";
import {
  createPublicClient,
  http,
  isAddress,
  verifyMessage,
  type Address,
  type Hex,
} from "viem";
import { avalancheFuji } from "viem/chains";
import { studentRegistryAbi } from "@/lib/contracts/abis";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_TTL_MS,
  UPLOAD_TYPES,
  uploadMessage,
  type UploadPermit,
} from "@/lib/uploadPermit";
import { VerificationError } from "@/lib/verify/errors";

export async function authorizeUpload(request: Request): Promise<UploadPermit> {
  const header = request.headers.get("authorization");
  if (!header) throw new VerificationError("UPLOAD_AUTH_REQUIRED", 401);
  const invalid = () => new VerificationError("UPLOAD_AUTH_INVALID", 401);
  if (header.length > 4096 || !/^Bearer [A-Za-z0-9+/]+={0,2}$/.test(header))
    throw invalid();
  let p: UploadPermit & { signature: Hex };
  try {
    p = JSON.parse(Buffer.from(header.slice(7), "base64").toString("utf8"));
  } catch {
    throw invalid();
  }
  const now = Date.now();
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    typeof p.wallet !== "string" ||
    !isAddress(p.wallet) ||
    p.wallet !== p.wallet.toLowerCase() ||
    p.origin !== new URL(request.url).origin ||
    p.chainId !== 43113 ||
    !Number.isSafeInteger(p.issuedAt) ||
    !Number.isSafeInteger(p.expiresAt) ||
    p.issuedAt > now + 30_000 ||
    p.expiresAt <= now ||
    p.expiresAt - p.issuedAt !== UPLOAD_TTL_MS ||
    !Number.isSafeInteger(p.size) ||
    p.size <= 0 ||
    p.size > MAX_UPLOAD_BYTES ||
    !UPLOAD_TYPES.includes(p.mime as (typeof UPLOAD_TYPES)[number]) ||
    typeof p.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.digest) ||
    typeof p.nonce !== "string" ||
    !/^[a-f0-9]{32}$/.test(p.nonce) ||
    typeof p.signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(p.signature)
  )
    throw invalid();
  const registry = process.env.NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS;
  if (
    !registry ||
    !isAddress(registry) ||
    Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113
  )
    throw new VerificationError("UPLOAD_CONFIG_MISSING", 503, {
      missing: [
        ...(!registry || !isAddress(registry) ? ["NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS"] : []),
        ...(Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113 ? ["NEXT_PUBLIC_CHAIN_ID"] : []),
      ],
    });
  if (p.registry !== registry.toLowerCase()) throw invalid();
  try {
    if (
      !(await verifyMessage({
        address: p.wallet as Address,
        message: uploadMessage(p),
        signature: p.signature,
      }))
    )
      throw invalid();
  } catch {
    throw invalid();
  }
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL, {
      timeout: 10_000,
      retryCount: 1,
    }),
  });
  try {
    if ((await client.getChainId()) !== 43113) throw new Error("Wrong chain");
    if (
      !(await client.readContract({
        address: registry as Address,
        abi: studentRegistryAbi,
        functionName: "isStudent",
        args: [p.wallet as Address],
      }))
    )
      throw new VerificationError("UPLOAD_FORBIDDEN", 403);
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError("UPLOAD_AUTH_UNAVAILABLE", 503);
  }
  return p;
}

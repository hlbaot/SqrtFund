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
import { qfRoundAbi, roundFactoryAbi } from "@/lib/contracts/abis";
import { legacyProjectAbi } from "@/lib/contracts/legacyProjectAbi";
import { isVersionReadError } from "@/lib/contracts/roundReads";
import {
  PROFILE_TTL,
  profileMessage,
  type ProfileChange,
  type ProfilePermit,
} from "@/lib/projectProfile";
import { VerificationError } from "@/lib/verify/errors";
export async function readProfileProject(round: string, projectId: string) {
  const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factory || !isAddress(factory))
    throw new VerificationError("PROFILE_UNAVAILABLE", 503);
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL, {
      timeout: 10000,
      retryCount: 1,
    }),
  });
  try {
    if ((await client.getChainId()) !== 43113) throw Error("Wrong chain");
    const rounds = await client.readContract({
      address: factory,
      abi: roundFactoryAbi,
      functionName: "getRounds",
    });
    if (!rounds.some((r) => r.toLowerCase() === round))
      throw new VerificationError("PROJECT_NOT_FOUND", 404);
    let rejection = true;
    try {
      await client.readContract({
        address: round as Address,
        abi: qfRoundAbi,
        functionName: "rejected",
        args: [0n],
      });
    } catch (e) {
      if (isVersionReadError(e)) rejection = false;
      else throw e;
    }
    const [page] = await client.readContract({
      address: round as Address,
      abi: rejection ? qfRoundAbi : legacyProjectAbi,
      functionName: "getProjects",
      args: [BigInt(projectId) - 1n, 1n],
    });
    const project = page[0];
    if (
      !project ||
      project.id !== BigInt(projectId) ||
      !project.approved ||
      ("rejected" in project && project.rejected)
    )
      throw new VerificationError("PROJECT_NOT_FOUND", 404);
    return project;
  } catch (e) {
    if (e instanceof VerificationError) throw e;
    throw new VerificationError("PROFILE_UNAVAILABLE", 503);
  }
}
export async function authorizeProfile(
  request: Request,
  change: ProfileChange,
  permit: ProfilePermit,
  signature: unknown,
) {
  const invalid = () => new VerificationError("PROFILE_AUTH_INVALID", 401),
    now = Date.now();
  if (
    !permit ||
    typeof permit.wallet !== "string" ||
    !isAddress(permit.wallet) ||
    permit.origin !== new URL(request.url).origin ||
    permit.chainId !== 43113 ||
    !Number.isSafeInteger(permit.issuedAt) ||
    !Number.isSafeInteger(permit.expiresAt) ||
    permit.issuedAt > now + 30000 ||
    permit.expiresAt <= now ||
    permit.expiresAt - permit.issuedAt !== PROFILE_TTL ||
    typeof signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(signature)
  )
    throw invalid();
  let valid = false;
  try {
    valid = await verifyMessage({
      address: permit.wallet as Address,
      message: profileMessage(change, permit),
      signature: signature as Hex,
    });
  } catch {}
  if (!valid) throw invalid();
  const project = await readProfileProject(change.round, change.projectId);
  if (project.owner.toLowerCase() !== permit.wallet.toLowerCase())
    throw new VerificationError("PROFILE_FORBIDDEN", 403);
  if (change.report && !project.claimed)
    throw new VerificationError("PROFILE_REPORT_BEFORE_CLAIM", 409);
  return permit.wallet.toLowerCase();
}

import "server-only";
import { BaseError, ContractFunctionRevertedError, ContractFunctionZeroDataError, createPublicClient, http, isAddress, type Address, type Hex } from "viem";
import { avalancheFuji } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { VerificationError } from "./errors";
import { studentRegistryAbi } from "@/lib/contracts/abis";
// emailHash là tên ABI legacy: giá trị mới là verification_id ngẫu nhiên từ backend.
export const verificationTypes = { StudentVerification: [
  { name: "student", type: "address" }, { name: "emailHash", type: "bytes32" }, { name: "expiry", type: "uint256" },
] } as const;
function attesterAccount() {
  const key = process.env.ATTESTER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new VerificationError("CONFIG_MISSING", 503, { missing: ["ATTESTER_PRIVATE_KEY"] });
  try { return privateKeyToAccount(key as Hex); }
  catch { throw new VerificationError("CONFIG_MISSING", 503, { missing: ["ATTESTER_PRIVATE_KEY"] }); }
}
export function getRegistryAddress(): Address {
  const registry = process.env.NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS;
  if (!registry || !isAddress(registry) || /^0x0{40}$/i.test(registry)) throw new VerificationError("CONFIG_MISSING", 503, { missing: ["NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS"] });
  return registry;
}
/** Identity is bound only to the configured registry, never a round or factory. */
export async function validateRegistry(): Promise<Address> {
  const registry = getRegistryAddress();
  const rpc = createPublicClient({ chain: avalancheFuji, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
  let signer: Address;
  try {
    signer = await rpc.readContract({ address: registry, abi: studentRegistryAbi, functionName: "attester" });
  } catch (error) {
    const cause = error instanceof BaseError ? error.walk(candidate =>
      candidate instanceof ContractFunctionRevertedError || candidate instanceof ContractFunctionZeroDataError) : error;
    if (cause instanceof ContractFunctionZeroDataError ||
        (cause instanceof ContractFunctionRevertedError && cause.raw === "0x")) {
      throw new VerificationError("REGISTRY_UNAVAILABLE", 503, { cause: error });
    }
    throw new VerificationError("REGISTRY_UNAVAILABLE", 503, { cause: error });
  }
  const expected = attesterAccount().address;
  if (signer.toLowerCase() !== expected.toLowerCase()) throw new VerificationError("REGISTRY_UNAVAILABLE", 503, {
    cause: new Error(`Registry ${registry}: on-chain attester ${signer}, server attester ${expected}`),
  });
  return registry;
}
export async function signVerification(student: Address, emailHash: Hex, expiry: bigint) {
  return attesterAccount().signTypedData({
    domain: { name: "SqrtFundStudentRegistry", version: "1", chainId: 43113, verifyingContract: getRegistryAddress() },
    types: verificationTypes, primaryType: "StudentVerification", message: { student, emailHash, expiry },
  });
}

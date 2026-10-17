import type { Abi, Address } from "viem";
import { qfRoundAbi } from "./abis";
export const roundCoreFunctions = ["admin", "token", "startTime", "endTime", "minDonation", "maxDonation", "maxMatchBps", "pool", "finalized", "leftover", "leftoverWithdrawn", "projectCount"] as const;
export const roundModernFunctions = ["name", "organizer", "maxPerRound"] as const;
export type RoundReadCall = { address: Address; abi: Abi; functionName: string };
export type RoundReadResult = { status: "success" | "failure" | "skipped"; result?: unknown; error?: unknown };
export type RoundBatchReader = (contracts: readonly RoundReadCall[]) => Promise<readonly RoundReadResult[]>;
export type RoundCapability = { version: "current" | "legacy"; registry?: Address };
export type RoundReadKind = "version" | "rpc";
export function isVersionReadError(error: unknown): boolean {
  let current = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const value = current as { name?: string; cause?: unknown };
    if (["ContractFunctionRevertedError", "ContractFunctionZeroDataError", "AbiDecodingZeroDataError", "AbiDecodingDataSizeTooSmallError"].includes(value.name ?? "")) return true;
    current = value.cause;
  }
  return false;
}
const reported = new Set<string>();
export function logContractReadFailure(address: Address, functionName: string, error: unknown): void {
  const kind = isVersionReadError(error) ? "version" : "rpc";
  const key = `${address.toLowerCase()}:${functionName}:${kind}`;
  if (reported.has(key)) return;
  reported.add(key);
  // Never log raw errors: provider errors may contain URLs with credentials.
  console.warn("[contract-read]", { address, functionName, kind });
}
export type RoundFields = RoundCapability & { results: readonly RoundReadResult[] };
/** Probe once per chain/address; legacy deployments never receive modern detail reads. */
export async function loadRoundFields(read: RoundBatchReader, address: Address, capabilities = new Map<string, RoundCapability>()): Promise<RoundFields> {
  const key = address.toLowerCase();
  let capability = capabilities.get(key);
  if (!capability) {
    let probe: RoundReadResult;
    try { [probe] = await read([{ address, abi: qfRoundAbi, functionName: "studentRegistry" }]); }
    catch (error) { logContractReadFailure(address, "studentRegistry", error); throw error; }
    if (!probe || probe.status !== "success") {
      const error = probe?.error ?? new Error("Missing registry response");
      logContractReadFailure(address, "studentRegistry", error);
      if (!isVersionReadError(error)) throw error;
      capability = { version: "legacy" };
    } else capability = { version: "current", registry: probe.result as Address };
    capabilities.set(key, capability);
  }
  const functions: readonly string[] = capability.version === "legacy" ? roundCoreFunctions : [...roundCoreFunctions, ...roundModernFunctions];
  let results: readonly RoundReadResult[];
  try { results = await read(functions.map(functionName => ({ address, abi: qfRoundAbi, functionName }))); }
  catch (error) { for (const fn of functions) logContractReadFailure(address, fn, error); throw error; }
  // Preserve positional fields for useRound callers; skipped metadata is not an error.
  const complete = functions.map((fn, index) => {
    const result = results[index] ?? { status: "failure" as const, error: new Error("Missing contract response") };
    if (result.status === "failure") logContractReadFailure(address, fn, result.error);
    return result;
  });
  if (capability.version === "legacy") complete.push(...roundModernFunctions.map(() => ({ status: "skipped" as const })));
  return { ...capability, results: complete };
}
export const roundReadRetry = { retry: 2, retryDelay: (attempt: number) => Math.min(750 * 2 ** attempt, 3000) };

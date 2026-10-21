import { parseEventLogs, type Address, type Log } from "viem";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { parseUsdc, type ParseUsdcResult } from "@/lib/format";

export function parseInitialPool(value: string, balance?: bigint): ParseUsdcResult {
  if (!value.trim()) return { success: true, amount: 0n, formatted: "0" };
  const parsed = parseUsdc(value, balance);
  return !parsed.success && parsed.errorKey === "zero"
    ? { success: true, amount: 0n, formatted: "0" } : parsed;
}

/** Resolve the deployment from this receipt, never from the factory's latest round. */
export function createdRoundAddress(logs: Log[], factory: Address, admin: Address, token: Address) {
  return parseEventLogs({ abi: roundFactoryAbi, eventName: "RoundCreated", logs: logs.filter(log => log.address.toLowerCase() === factory.toLowerCase()) })
    .find(event => event.args.admin.toLowerCase() === admin.toLowerCase() && event.args.token.toLowerCase() === token.toLowerCase())?.args.roundAddress;
}

export async function fundRound(amount: bigint, actions: {
  allowance: () => Promise<bigint>;
  approve: () => Promise<`0x${string}`>;
  deposit: () => Promise<`0x${string}`>;
  confirm: (hash: `0x${string}`) => Promise<void>;
}) {
  if (amount === 0n) return;
  if (amount < 0n) throw new Error("Negative matching pool");
  if (await actions.allowance() < amount) await actions.confirm(await actions.approve());
  await actions.confirm(await actions.deposit());
}

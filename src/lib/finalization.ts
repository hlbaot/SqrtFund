import { type Address, type PublicClient } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { isVersionReadError } from "@/lib/contracts/roundReads";
export type FinalizationTiming = { finalizedAt: number; blockNumber: string };
/** Tìm bước chuyển false→true theo state lịch sử, xác minh event và block timestamp; không đoán hạn từ endTime hay lúc app thấy vòng; lỗi lịch sử/RPC giữ trạng thái unknown, không phạt dự án. */
export async function readFinalizationTiming(client: Pick<PublicClient, "readContract" | "getBlockNumber" | "getBlock" | "getBytecode" | "getContractEvents">, address: Address): Promise<FinalizationTiming | null> {
  const head = await client.getBlockNumber({ cacheTime: 0 });
  const read = async (blockNumber: bigint) => {
    try {
      const value = await client.readContract({ address, abi: qfRoundAbi, functionName: "finalized", blockNumber });
      if (typeof value !== "boolean") throw Error("Invalid finalized state");
      return value;
    } catch (error) {
      if (isVersionReadError(error)) {
        const code = await client.getBytecode({ address, blockNumber });
        if (!code || code === "0x") return false;
      }
      throw error;
    }
  };
  if (!await read(head)) return null;
  let low = 0n, high = head;
  while (low < high) {
    const mid = (low + high) / 2n;
    if (await read(mid)) high = mid; else low = mid + 1n;
  }
  const [block, events] = await Promise.all([
    client.getBlock({ blockNumber: low }),
    client.getContractEvents({ address, abi: qfRoundAbi, eventName: "Finalized", fromBlock: low, toBlock: low, strict: true }),
  ]);
  if (events.length !== 1 || events[0].blockHash !== block.hash || !Number.isSafeInteger(Number(block.timestamp)) || block.timestamp <= 0n) throw Error("Unconfirmed finalization timestamp");
  return { finalizedAt: Number(block.timestamp), blockNumber: low.toString() };
}

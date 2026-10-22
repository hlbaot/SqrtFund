import type { Address, PublicClient } from "viem";
import { roundFactoryAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { ZERO_ADDRESS } from "@/lib/contracts/addresses";

export type OrganizerEntry = { address: Address; authorized: boolean | undefined; source: "event" | "round_admin" | "manual" };
const history = new Map<string, { through: bigint; addresses: Address[] }>();

/** Đọc lịch sử on-chain để đổi trình duyệt vẫn thấy các Organizer chưa tạo vòng. */
export async function loadOrganizerRegistry(client: PublicClient, factory: Address, rounds: Address[], owner?: Address): Promise<OrganizerEntry[]> {
  const latest = await client.getBlockNumber({ cacheTime: 0 });
  const key = `${client.chain?.id}:${factory.toLowerCase()}`;
  const previous = history.get(key);
  const discovered = new Map<string, OrganizerEntry["source"]>();
  previous?.addresses.forEach(address => discovered.set(address.toLowerCase(), "event"));
  const readEvents = async (fromBlock: bigint, toBlock: bigint) => {
    const events = await client.getContractEvents({ address: factory, abi: roundFactoryAbi, eventName: "OrganizerUpdated", fromBlock, toBlock, strict: true });
    events.forEach(event => discovered.set(event.args.organizer.toLowerCase(), "event"));
  };
  const from = previous && previous.through <= latest ? previous.through + 1n : 0n;
  if (from <= latest) {
    try {
      await readEvents(from, latest);
    } catch {
      // Một số RPC giới hạn khoảng block. Tìm block triển khai rồi chia nhỏ,
      // tránh quét hàng triệu block trước khi Factory tồn tại.
      let first = from;
      if (from === 0n) {
        let low = 0n;
        let high = latest;
        while (low < high) {
          const mid = (low + high) / 2n;
          const code = await client.getCode({ address: factory, blockNumber: mid });
          if (code && code !== "0x") high = mid;
          else low = mid + 1n;
        }
        first = low;
      }
      for (let start = first; start <= latest; start += 2048n) {
        await readEvents(start, start + 2047n < latest ? start + 2047n : latest);
      }
    }
    // Chỉ lưu mốc quét khi tất cả các khoảng block đều đọc thành công.
    history.set(key, { through: latest, addresses: [...discovered.keys()] as Address[] });
  }
  if (rounds.length) {
    const admins = await client.multicall({ contracts: rounds.map(address => ({ address, abi: qfRoundAbi, functionName: "admin" as const })), allowFailure: true });
    for (const result of admins) {
      if (result.status === "failure") throw result.error;
      const address = result.result.toLowerCase();
      if (address !== ZERO_ADDRESS && !discovered.has(address)) discovered.set(address, "round_admin");
    }
  }
  if (owner && owner.toLowerCase() !== ZERO_ADDRESS && !discovered.has(owner.toLowerCase())) discovered.set(owner.toLowerCase(), "manual");
  const addresses = [...discovered.keys()] as Address[];
  if (!addresses.length) return [];
  const results = await client.multicall({ contracts: addresses.map(address => ({ address: factory, abi: roundFactoryAbi, functionName: "authorizedOrganizers" as const, args: [address] })), allowFailure: true });
  return addresses.map((address, index) => ({
    address, source: discovered.get(address)!,
    // Lỗi RPC là trạng thái chưa biết, không phải đã bị thu hồi.
    authorized: results[index]?.status === "success" ? Boolean(results[index].result) : undefined,
  }));
}

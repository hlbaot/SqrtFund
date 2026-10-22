import type { Address, PublicClient } from "viem";
import { roundFactoryAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { ZERO_ADDRESS } from "@/lib/contracts/addresses";

export type OrganizerEntry = { address: Address; authorized: boolean | undefined; source: "event" | "round_admin" | "manual" };
const history = new Map<string, { through: bigint; addresses: Address[] }>();

type RegistryOptions = {
  knownAddresses?: Address[];
  onProgress?: (entries: OrganizerEntry[]) => void;
  onHistoryStatus?: (complete: boolean, error: boolean) => void;
};

/** Đọc quyền hiện tại trước; lịch sử lớn được quét tiếp qua mỗi lần làm mới. */
export async function loadOrganizerRegistry(client: PublicClient, factory: Address, rounds: Address[], owner?: Address, options: RegistryOptions = {}): Promise<OrganizerEntry[]> {
  const key = `${client.chain?.id}:${factory.toLowerCase()}`;
  const previous = history.get(key);
  const discovered = new Map<string, OrganizerEntry["source"]>();
  const eventAddresses = new Set(previous?.addresses ?? []);
  eventAddresses.forEach(address => discovered.set(address.toLowerCase(), "event"));
  options.knownAddresses?.forEach(address => discovered.set(address.toLowerCase(), "manual"));
  if (owner && owner.toLowerCase() !== ZERO_ADDRESS) discovered.set(owner.toLowerCase(), "manual");

  const readPermissions = async (): Promise<OrganizerEntry[]> => {
    const addresses = [...discovered.keys()] as Address[];
    if (!addresses.length) return [];
    const contracts = addresses.map(address => ({ address: factory, abi: roundFactoryAbi, functionName: "authorizedOrganizers" as const, args: [address] as const }));
    const results = await client.multicall({ contracts, allowFailure: true });
    return addresses.map((address, index) => ({
      address, source: discovered.get(address)!,
      // Lỗi đọc không đồng nghĩa với việc quyền đã bị thu hồi.
      authorized: results[index]?.status === "success" ? Boolean(results[index].result) : undefined,
    }));
  };

  // Đơn đã duyệt vẫn hiện ngay cả khi RPC không đọc được lịch sử cũ.
  if (discovered.size) options.onProgress?.(await readPermissions());
  let historyFailure: unknown;
  let roundReadFailure = false;
  try {
    const latest = await client.getBlockNumber({ cacheTime: 0 });
    const readEvents = async (fromBlock: bigint, toBlock: bigint) => {
      const events = await client.getContractEvents({ address: factory, abi: roundFactoryAbi, eventName: "OrganizerUpdated", fromBlock, toBlock, strict: true });
      events.forEach(event => {
        const address = event.args.organizer.toLowerCase() as Address;
        eventAddresses.add(address);
        discovered.set(address, "event");
      });
    };
    const from = previous && previous.through <= latest ? previous.through + 1n : 0n;
    let through = from - 1n;
    if (from <= latest) {
      if (latest - from < 100n) {
        await readEvents(from, latest);
        through = latest;
      } else {
        let first = from;
        if (from === 0n) {
          // Tìm block deploy một lần, tránh quét hàng chục triệu block trống.
          let low = 0n;
          let high = latest;
          while (low < high) {
            const mid = (low + high) / 2n;
            const code = await client.getCode({ address: factory, blockNumber: mid });
            if (code && code !== "0x") high = mid;
            else low = mid + 1n;
          }
          first = low;
          history.set(key, { through: first - 1n, addresses: [...eventAddresses] });
        }
        // RPC công cộng Fuji giới hạn 100 block. Giới hạn số trang mỗi lượt
        // để giao diện không bị chặn; lưu từng trang để lần sau quét tiếp.
        const stop = first + 1999n < latest ? first + 1999n : latest;
        for (let start = first; start <= stop; start += 100n) {
          const end = start + 99n < stop ? start + 99n : stop;
          await readEvents(start, end);
          through = end;
          history.set(key, { through, addresses: [...eventAddresses] });
        }
      }
      history.set(key, { through, addresses: [...eventAddresses] });
    }
    options.onHistoryStatus?.(through >= latest, false);
  } catch (error) {
    historyFailure = error;
    options.onHistoryStatus?.(false, true);
  }
  if (rounds.length) {
    try {
      const admins = await client.multicall({ contracts: rounds.map(address => ({ address, abi: qfRoundAbi, functionName: "admin" as const })), allowFailure: true });
      for (const result of admins) {
        if (result.status === "failure") { roundReadFailure = true; continue; }
        const address = result.result.toLowerCase();
        if (address !== ZERO_ADDRESS && !discovered.has(address)) discovered.set(address, "round_admin");
      }
    } catch { roundReadFailure = true; }
  }
  if (roundReadFailure) options.onHistoryStatus?.(false, true);
  if (!discovered.size && historyFailure) throw historyFailure;
  return readPermissions();
}

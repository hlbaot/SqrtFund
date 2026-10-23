import { parseAbi, isAddress } from "viem";

const factoryAbi = parseAbi(["function getRounds() view returns (address[])"]);

/** Cursor chỉ tiến sau khi đọc đủ log; lỗi RPC sẽ thử lại cùng đoạn ở lần sau. */
export function createChainPoller(client, factory, changed) {
  if (!isAddress(factory)) throw new Error("Invalid Factory address");
  let cursor;
  return async () => {
    const head = await client.getBlockNumber({ cacheTime: 0 });
    if (cursor === undefined) { cursor = head; return; }
    const rounds = await client.readContract({ address: factory, abi: factoryAbi, functionName: "getRounds" });
    // Fuji public RPC giới hạn 100 block/getLogs. Giới hạn 5 đoạn mỗi tick để bắt kịp dần.
    for (let batch = 0; cursor < head && batch < 5; batch++) {
      const toBlock = cursor + 100n < head ? cursor + 100n : head;
      const addresses = [factory, ...rounds];
      let hasChanges = false;
      for (let i = 0; i < addresses.length; i += 20) {
        const logs = await client.getLogs({ address: addresses.slice(i, i + 20), fromBlock: cursor + 1n, toBlock });
        if (logs.some(log => !log.removed)) hasChanges = true;
      }
      if (hasChanges) changed();
      cursor = toBlock;
    }
  };
}

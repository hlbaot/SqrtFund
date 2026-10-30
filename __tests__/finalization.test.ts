import { expect, it, vi } from "vitest";
import { ContractFunctionZeroDataError, type PublicClient } from "viem";
import { readFinalizationTiming } from "@/lib/finalization";
const address = `0x${"1".repeat(40)}` as const;
function fixture(transition = 77n) {
  const client = {
    getBlockNumber: vi.fn().mockResolvedValue(128n),
    readContract: vi.fn().mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => blockNumber >= transition),
    getBytecode: vi.fn().mockResolvedValue("0x"),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1000n, hash: "0xabc" }),
    getContractEvents: vi.fn().mockResolvedValue([{ blockHash: "0xabc" }]),
  };
  return { client, reader: client as unknown as Pick<PublicClient, "readContract" | "getBlockNumber" | "getBlock" | "getBytecode" | "getContractEvents"> };
}
it("finds the actual transition block and verifies its Finalized event", async () => {
  const { client, reader } = fixture();
  expect(await readFinalizationTiming(reader, address)).toEqual({ finalizedAt: 1000, blockNumber: "77" });
  expect(client.getContractEvents).toHaveBeenCalledWith(expect.objectContaining({ address, eventName: "Finalized", fromBlock: 77n, toBlock: 77n }));
  expect(client.readContract.mock.calls.length).toBeLessThan(12);
});
it("returns no timing for a round that has not finalized", async () => {
  const { client, reader } = fixture(999n);
  expect(await readFinalizationTiming(reader, address)).toBeNull();
  expect(client.getBlock).not.toHaveBeenCalled();
});
it("only treats historical zero-data as predeployment after checking empty bytecode", async () => {
  const { client, reader } = fixture(3n);
  client.readContract.mockImplementation(async ({ blockNumber }) => {
    if (blockNumber < 3n) throw new ContractFunctionZeroDataError({ functionName: "finalized" });
    return blockNumber >= 3n;
  });
  expect(await readFinalizationTiming(reader, address)).toMatchObject({ blockNumber: "3" });
  expect(client.getBytecode).toHaveBeenCalled();
});
it("keeps archive/RPC errors unknown instead of fabricating a timestamp", async () => {
  const { client, reader } = fixture();
  client.readContract.mockRejectedValueOnce(Error("RPC down"));
  await expect(readFinalizationTiming(reader, address)).rejects.toThrow("RPC down");
});
it("rejects an absent event or a different block hash", async () => {
  const { client, reader } = fixture();
  client.getContractEvents.mockResolvedValueOnce([]);
  await expect(readFinalizationTiming(reader, address)).rejects.toThrow("Unconfirmed");
  client.getContractEvents.mockResolvedValueOnce([{ blockHash: "0xwrong" }]);
  await expect(readFinalizationTiming(reader, address)).rejects.toThrow("Unconfirmed");
});

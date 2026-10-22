import { expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { loadOrganizerRegistry } from "@/lib/organizerRegistry";

const organizerA = "0x1111111111111111111111111111111111111111" as Address;
const organizerB = "0x2222222222222222222222222222222222222222" as Address;
let id = 100;
const factory = () => `0x${(++id).toString(16).padStart(40, "0")}` as Address;
function setup() {
  const client = {
    chain: { id: 43113 },
    getBlockNumber: vi.fn().mockResolvedValue(50n),
    getCode: vi.fn().mockResolvedValue("0x1234"),
    getContractEvents: vi.fn().mockResolvedValue([{ args: { organizer: organizerA, authorized: true } }]),
    multicall: vi.fn().mockResolvedValue([{ status: "success", result: true }]),
  };
  return { client, load: (address = factory()) => loadOrganizerRegistry(client as unknown as PublicClient, address, []) };
}
it("discovers an Organizer with no rounds and no browser storage", async () => {
  const { load } = setup();
  expect(await load()).toEqual([{ address: organizerA, authorized: true, source: "event" }]);
});
it("reads current authorization rather than trusting a historical grant event", async () => {
  const { client, load } = setup();
  client.multicall.mockResolvedValue([{ status: "success", result: false }]);
  expect(await load()).toMatchObject([{ address: organizerA, authorized: false }]);
});
it("keeps failed authorization reads unknown instead of displaying revoked", async () => {
  const { client, load } = setup();
  client.multicall.mockResolvedValue([{ status: "failure", error: new Error("RPC unavailable") }]);
  expect(await load()).toMatchObject([{ address: organizerA, authorized: undefined }]);
});
it("falls back to deployment-block discovery and bounded log ranges", async () => {
  const { client, load } = setup();
  client.getBlockNumber.mockResolvedValue(5000n);
  client.getCode.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => blockNumber >= 5n ? "0x1234" : "0x");
  client.getContractEvents.mockImplementation(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
    if (toBlock - fromBlock >= 2048n) throw new Error("Range too large");
    return fromBlock === 5n ? [{ args: { organizer: organizerA, authorized: true } }] : [];
  });
  expect(await load()).toMatchObject([{ address: organizerA, authorized: true }]);
  expect(client.getContractEvents.mock.calls.map(([range]) => [range.fromBlock, range.toBlock])).toEqual([[0n, 5000n], [5n, 2052n], [2053n, 4100n], [4101n, 5000n]]);
});
it("adds later grants while retaining previously discovered Organizers", async () => {
  const { client, load } = setup(); const address = factory();
  await load(address);
  client.getBlockNumber.mockResolvedValue(51n);
  client.getContractEvents.mockResolvedValue([{ args: { organizer: organizerB, authorized: true } }]);
  client.multicall.mockResolvedValue([{ status: "success", result: false }, { status: "success", result: true }]);
  expect(await load(address)).toMatchObject([{ address: organizerA, authorized: false }, { address: organizerB, authorized: true }]);
  expect(client.getContractEvents).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 51n, toBlock: 51n }));
});
it("surfaces failed history reads instead of claiming the registry is empty", async () => {
  const { client, load } = setup();
  client.getContractEvents.mockRejectedValue(new Error("RPC unavailable"));
  client.getCode.mockRejectedValue(new Error("RPC unavailable"));
  await expect(load()).rejects.toThrow("RPC unavailable");
});

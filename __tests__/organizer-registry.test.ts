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
  const address = factory();
  client.getBlockNumber.mockResolvedValue(5000n);
  client.getCode.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => blockNumber >= 5n ? "0x1234" : "0x");
  client.getContractEvents.mockImplementation(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
    if (toBlock - fromBlock >= 100n) throw new Error("Range too large");
    return fromBlock === 5n ? [{ args: { organizer: organizerA, authorized: true } }] : [];
  });
  expect(await load(address)).toMatchObject([{ address: organizerA, authorized: true }]);
  expect(client.getContractEvents).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 1905n, toBlock: 2004n }));
  expect(client.getContractEvents.mock.calls).toHaveLength(20);
  expect(client.getContractEvents.mock.calls.every(([range]) => range.toBlock - range.fromBlock < 100n)).toBe(true);
  const codeCalls = client.getCode.mock.calls.length;
  // Lần sau tiếp tục đúng block, không quét lại hoặc bỏ sót các trang cũ.
  client.getContractEvents.mockClear();
  expect(await load(address)).toMatchObject([{ address: organizerA, authorized: true }]);
  expect(client.getContractEvents.mock.calls[0][0]).toMatchObject({ fromBlock: 2005n, toBlock: 2104n });
  expect(client.getCode.mock.calls).toHaveLength(codeCalls);
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

it("shows approved application wallets before history and keeps them on archive RPC failure", async () => {
  const { client } = setup();
  client.getContractEvents.mockRejectedValue(new Error("archive unavailable"));
  client.getCode.mockRejectedValue(new Error("archive unavailable"));
  const progress = vi.fn(); const status = vi.fn();
  const entries = await loadOrganizerRegistry(client as unknown as PublicClient, factory(), [], undefined, {
    knownAddresses: [organizerB], onProgress: progress, onHistoryStatus: status,
  });
  expect(progress).toHaveBeenCalledWith([{ address: organizerB, source: "manual", authorized: true }]);
  expect(entries).toEqual([{ address: organizerB, source: "manual", authorized: true }]);
  expect(status).toHaveBeenLastCalledWith(false, true);
});
it("preserves a successful page if the next RPC page fails", async () => {
  const { client, load } = setup(); const address = factory();
  client.getBlockNumber.mockResolvedValue(500n);
  client.getContractEvents.mockImplementation(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
    if (toBlock - fromBlock >= 100n || fromBlock === 100n) throw new Error("RPC failed");
    return [{ args: { organizer: organizerA, authorized: true } }];
  });
  expect(await load(address)).toMatchObject([{ address: organizerA, authorized: true }]);
  client.getContractEvents.mockClear();
  await load(address);
  expect(client.getContractEvents.mock.calls[0][0]).toMatchObject({ fromBlock: 100n });
});

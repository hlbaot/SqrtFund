import { expect, it, vi } from "vitest";
import type { Address } from "viem";
import { loadWalletRoundDonations } from "@/lib/walletDonationHistory";

const wallet = `0x${"1".repeat(40)}` as Address;
const active = `0x${"2".repeat(40)}` as Address;
const ended = `0x${"3".repeat(40)}` as Address;
function reader(options: { count?: number; finalized?: boolean; cancelled?: boolean; donationError?: boolean; matchingError?: boolean; amount?: bigint } = {}) {
  return vi.fn(async (call: { address: Address; functionName: string; args?: readonly unknown[] }) => {
    const { functionName: fn, args } = call;
    if (fn === "admin") return wallet;
    if (fn === "endTime") return call.address === active ? 9_999_999_999n : 1n;
    if (fn === "finalized") return options.finalized === true;
    if (fn === "isCancelled") return options.cancelled === true;
    if (fn === "rejected") return false;
    if (fn === "getProjects") {
      const count = options.count ?? 1;
      const projects = Array.from({ length: count }, (_, i) => ({ id: BigInt(i + 1), name: `Project ${i + 1}`, owner: wallet, approved: true }));
      return [projects.slice(Number(args![0]), Number(args![0]) + 50), BigInt(count)];
    }
    if (fn === "donationOf") {
      if (options.donationError) throw new Error("RPC down");
      expect(args![0]).toBe(wallet);
      return BigInt(args![1] as bigint) === BigInt(options.count ?? 1) ? options.amount ?? 2_000_000n : 0n;
    }
    if (options.matchingError) throw new Error("Matching unavailable");
    if (fn === "payoutOf") return 8_000_000n;
    if (fn === "previewMatching") return [[1n], [4_000_000n]];
    throw new Error(`Unexpected function ${fn}`);
  });
}

it("retains donations in both open and ended rounds, scoped by round and project", async () => {
  const read = reader();
  const rows = [...await loadWalletRoundDonations(read, active, wallet), ...await loadWalletRoundDonations(read, ended, wallet)];
  expect(rows.map(row => [row.roundAddress, row.project.id, row.amount])).toEqual([[active, "1", 2_000_000n], [ended, "1", 2_000_000n]]);
  expect(rows[0].project.matching).toBe(4_000_000n);
});

it("reads beyond the first project page", async () => {
  const read = reader({ count: 51 });
  const rows = await loadWalletRoundDonations(read, ended, wallet);
  expect(rows).toHaveLength(1);
  expect(rows[0].project.id).toBe("51");
  expect(read.mock.calls.filter(([call]) => call.functionName === "getProjects")).toHaveLength(2);
});

it("uses recorded payouts for finalized rounds rather than live matching estimates", async () => {
  const read = reader({ finalized: true });
  const rows = await loadWalletRoundDonations(read, ended, wallet);
  expect(rows[0].project.matching).toBe(8_000_000n);
  expect(read.mock.calls.some(([call]) => call.functionName === "previewMatching")).toBe(false);
});

it("keeps original donations visible after a cancelled round has refunded them", async () => {
  const rows = await loadWalletRoundDonations(reader({ cancelled: true, amount: 0n }), ended, wallet,
    async () => ({ "1": 3_000_000n }));
  expect(rows[0].amount).toBe(3_000_000n);
  expect(rows[0].isCancelled).toBe(true);
  expect(rows[0].project.matching).toBe(0n);
});

it("reports donation read failures and incomplete historical scans instead of returning empty history", async () => {
  await expect(loadWalletRoundDonations(reader({ donationError: true }), ended, wallet)).rejects.toThrow("RPC down");
  await expect(loadWalletRoundDonations(reader({ cancelled: true }), ended, wallet,
    async () => { throw new Error("Incomplete scan"); })).rejects.toThrow("Incomplete scan");
});

it("keeps confirmed donations visible even if matching data is unavailable", async () => {
  for (const finalized of [false, true]) {
    const rows = await loadWalletRoundDonations(reader({ matchingError: true, finalized }), ended, wallet);
    expect(rows[0].amount).toBe(2_000_000n);
    expect(rows[0].project.matching).toBeUndefined();
  }
});

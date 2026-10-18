import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { canCancelRound, matchesCancellationInput, refundRows, refundTotal, loadDonationHistory, createBlockChunks } from "@/lib/roundRefunds";
import { calculateRoundStats } from "@/lib/roundStats";
import { CancelRoundDialog, DonorRefundTable, PoolRecoveryCard } from "@/components/round/CancellationViews";
import { copy } from "@/lib/copy";

const state = vi.hoisted(() => ({ input: "" }));
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(initial === "" ? state.input : initial) };
});
vi.mock("@/components/ui/Dialog", () => ({
  Dialog: ({ children, title }: { children: import("react").ReactNode; title: string }) =>
    createElement("section", { role: "dialog" }, createElement("h2", null, title), children),
}));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ locale: "vi", t: copy.vi }) };
});

const wallet = "0x1111111111111111111111111111111111111111";
const address = "0x2222222222222222222222222222222222abcdef";
const round = { admin: wallet, finalized: false, isCancelled: false, supportsPhase2: true };

beforeEach(() => {
  state.input = "";
});

it.each([
  [wallet, {}, true],
  ["0xOther", {}, false],
  [undefined, {}, false],
  [wallet, { finalized: true }, false],
  [wallet, { isCancelled: true }, false],
  [wallet, { supportsPhase2: false }, false],
] as const)("cancel visibility %s %s", (viewer, patch, expected) =>
  expect(canCancelRound({ ...round, ...patch }, viewer)).toBe(expected)
);

it("requires the full round name or exact 6-character suffix", () => {
  expect(matchesCancellationInput("Student fund", "Student fund", address)).toBe(true);
  expect(matchesCancellationInput("ABCDEF", "Student fund", address)).toBe(true);
  expect(matchesCancellationInput("student fund", "Student fund", address)).toBe(false);
  expect(matchesCancellationInput("abcde", "Student fund", address)).toBe(false);
  expect(matchesCancellationInput("", undefined, address)).toBe(false);
});

function dialog(overrides: Partial<Parameters<typeof CancelRoundDialog>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(CancelRoundDialog, {
      name: "Student fund",
      address,
      ended: true,
      totalDonated: 5_000_000n,
      supporterCount: 2,
      pool: 10_000_000n,
      pending: false,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      onRetryStats: vi.fn(),
      ...overrides,
    })
  );
}

function confirmAttributes(html: string) {
  return (
    [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(
      match => match[2].includes(copy.vi.cancellation.confirm) || match[2].includes(copy.vi.cancellation.processing)
    )?.[1] ?? ""
  );
}

it("modal presents round identity, accurate amounts and requires typed confirmation", () => {
  let html = dialog();
  expect(html).toContain("Student fund");
  expect(html).toContain(address);
  expect(html).toContain("5 USDC");
  expect(html).toContain("10 USDC");
  expect(html).toContain(copy.vi.cancellation.explanation);
  expect(html).toContain(copy.vi.cancellation.ended);
  expect(confirmAttributes(html)).toMatch(/\sdisabled(?:=|\s|$)/);

  state.input = "Student fund";
  html = dialog();
  expect(confirmAttributes(html)).not.toMatch(/\sdisabled(?:=|\s|$)/);

  state.input = "abcdef";
  expect(confirmAttributes(dialog())).not.toMatch(/\sdisabled(?:=|\s|$)/);
});

it("confirmation allowed status does not depend on stats loading or error", () => {
  state.input = "Student fund";
  expect(confirmAttributes(dialog({ statsLoading: true }))).not.toMatch(/\sdisabled(?:=|\s|$)/);
  expect(confirmAttributes(dialog({ statsError: true }))).not.toMatch(/\sdisabled(?:=|\s|$)/);
  expect(confirmAttributes(dialog({ statsLoading: false, statsError: false }))).not.toMatch(/\sdisabled(?:=|\s|$)/);
});

it("cannot confirm while pending or if finalization/cancellation changes", () => {
  state.input = "Student fund";
  for (const patch of [{ pending: true }, { blocked: copy.vi.cancellation.noLongerAllowed }]) {
    expect(confirmAttributes(dialog(patch))).toMatch(/\sdisabled(?:=|\s|$)/);
  }
});

it("computes refund totals only from successful current donationOf reads and never marks a never-donor as refunded", () => {
  const rows = refundRows(
    [1n, 2n, 3n, 4n],
    [
      { status: "success", result: 2_000_001n },
      { status: "success", result: 0n },
      { status: "success", result: 0n },
      { status: "failure" },
    ],
    { "1": 3_000_000n, "2": 5_000_000n }
  );
  expect(refundTotal(rows)).toBe(2_000_001n);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({ projectId: 2n, refunded: true, originalAmount: 5_000_000n });
  const html = renderToStaticMarkup(
    createElement(DonorRefundTable, { rows, total: refundTotal(rows), pending: false, onRefund: vi.fn(), onRefundAll: vi.fn() })
  );
  expect(html).toContain(copy.vi.cancellation.refunded);
  expect(html).toContain("2.000001 USDC");
});

it("locks the pool card after withdrawal, including its retained button", () => {
  const html = renderToStaticMarkup(
    createElement(PoolRecoveryCard, { pool: 10_000_000n, withdrawn: true, pending: false, onWithdraw: vi.fn() })
  );
  expect(html).toContain("0 USDC");
  expect(html).toContain(copy.vi.cancellation.poolOnly);
  expect(html).toContain(copy.vi.cancellation.withdrawn);
  expect(html).toMatch(/<button[^>]*\sdisabled(?:=|\s|>)/);
});

describe("calculateRoundStats (requirement 6a)", () => {
  it("returns 0 values for empty or undefined projects without producing '—'", () => {
    expect(calculateRoundStats([])).toEqual({
      approvedCount: 0,
      totalDonatedRaw: 0n,
      totalDonated: 0,
      totalSupporters: 0,
    });
    expect(calculateRoundStats(undefined)).toEqual({
      approvedCount: 0,
      totalDonatedRaw: 0n,
      totalDonated: 0,
      totalSupporters: 0,
    });
  });

  it("accurately sums totalDonated and supporters strictly for approved projects", () => {
    const projects = [
      { id: "1", status: "approved" as const, approved: true, totalDonated: 7, totalDonatedRaw: 7_000_000n, supporterCount: 3 },
      { id: "2", status: "approved" as const, approved: true, totalDonated: 9, totalDonatedRaw: 9_000_000n, supporterCount: 3 },
      { id: "3", status: "pending" as const, approved: false, totalDonated: 5, totalDonatedRaw: 5_000_000n, supporterCount: 2 },
    ];
    const stats = calculateRoundStats(projects);
    expect(stats.approvedCount).toBe(2);
    expect(stats.totalDonatedRaw).toBe(16_000_000n);
    expect(stats.totalDonated).toBe(16);
    expect(stats.totalSupporters).toBe(6);
  });
});

describe("createBlockChunks (requirement 6c)", () => {
  it("chunks block ranges into segments of at most 100 blocks", () => {
    const plan = createBlockChunks(1000n, 1250n, 100n, 300);
    expect(plan.chunks).toHaveLength(3);
    expect(plan.chunks[0]).toEqual({ from: 1000n, to: 1099n });
    expect(plan.chunks[1]).toEqual({ from: 1100n, to: 1199n });
    expect(plan.chunks[2]).toEqual({ from: 1200n, to: 1250n });
    expect(plan.totalBlocks).toBe(251n);
    expect(plan.scannedBlocks).toBe(251n);
    expect(plan.capped).toBe(false);

    // Verify each chunk is <= 100 blocks
    for (const chunk of plan.chunks) {
      expect(chunk.to - chunk.from + 1n).toBeLessThanOrEqual(100n);
    }
  });

  it("strictly enforces maxRequests limit of 300 and flags capped", () => {
    // 50,000 blocks would take 500 chunks of 100
    const plan = createBlockChunks(1000n, 50999n, 100n, 300);
    expect(plan.totalPossibleChunks).toBe(500);
    expect(plan.chunks).toHaveLength(300);
    expect(plan.capped).toBe(true);
    expect(plan.chunks[0].from).toBe(1000n);
    expect(plan.chunks[299].to).toBe(1000n + 300n * 100n - 1n);
    expect(plan.scannedBlocks).toBe(30_000n);
    expect(plan.totalBlocks).toBe(50_000n);
  });
});

it("counts unique donor wallets and accumulates incremental event reads without double counting", async () => {
  const event = (donor: string, projectId: bigint, amount: bigint) => ({ args: { donor, projectId, amount } });
  const logs = vi
    .fn()
    .mockResolvedValueOnce([event(wallet, 1n, 2n), event(wallet, 2n, 3n), event("0x3333333333333333333333333333333333333333", 1n, 5n)])
    .mockResolvedValueOnce([event(wallet, 1n, 7n)]);
  const block = vi.fn().mockResolvedValueOnce(110n).mockResolvedValueOnce(111n);
  const client = {
    getBlockNumber: block,
    getBytecode: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => (blockNumber >= 100n ? "0x01" : undefined)),
    getContractEvents: logs,
  } as unknown as PublicClient;

  const first = await loadDonationHistory(client, address);
  expect(first.firstBlock).toBe(100n);
  expect(first.totalDonated).toBe(10n);
  expect(first.donorCount).toBe(2);

  const next = await loadDonationHistory(client, address, first);
  expect(next.totalDonated).toBe(17n);
  expect(next.contributions[wallet]["1"]).toBe(9n);
  expect(first.totalDonated).toBe(10n);
});

it("does not fabricate empty history when RPC logs fail", async () => {
  const client = {
    getBlockNumber: async () => 1n,
    getContractEvents: async () => {
      throw new Error("RPC offline");
    },
  } as unknown as PublicClient;
  await expect(loadDonationHistory(client, address)).rejects.toThrow("RPC offline");
});

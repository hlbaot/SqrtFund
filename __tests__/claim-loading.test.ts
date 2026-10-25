// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useClaim } from "@/hooks/useClaim";

const f = vi.hoisted(() => ({ write: vi.fn(), receipt: vi.fn(), refetch: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/contracts/addresses", () => ({ TARGET_CHAIN_ID: 43113, usdcAddress: `0x${"3".repeat(40)}` }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: `0x${"1".repeat(40)}`, isConnected: true, chainId: 43113 }),
  useChainId: () => 43113,
  useReadContracts: () => ({ data: [0n, 3600n, 0n, 100_000_000n, 1_000_000_000n].map(result => ({ status: "success", result })), refetch: f.refetch }),
  useWriteContract: () => ({ writeContractAsync: f.write }),
  usePublicClient: () => client,
}));
const client = { waitForTransactionReceipt: f.receipt };
const query = { invalidateQueries: f.invalidate, fetchQuery: vi.fn().mockResolvedValue({ timestamp: 1000n, sampledAt: 1000 }) };
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => query }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => 1000 }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: `0x${"2".repeat(40)}` }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => () => ({
  wait: (work: () => Promise<unknown>) => work(), finish: vi.fn(), error: vi.fn(),
  toast: { pending: vi.fn(), success: vi.fn() },
}) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});

let root: Root;
let host: HTMLDivElement;
let state: ReturnType<typeof useClaim>;
function Probe() {
  const snapshot = useClaim();
  useEffect(() => { state = snapshot; });
  return createElement("button", { "data-faucet-loading": snapshot.isClaimingUsdc }, "Faucet");
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  f.receipt.mockResolvedValue({ status: "success" });
  await act(async () => root.render(createElement(Probe)));
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

it.each(["matching", "faucet"])("keeps the loading state scoped to the %s transaction", async kind => {
  let resolveWrite!: (hash: `0x${string}`) => void;
  f.write.mockReturnValue(new Promise<`0x${string}`>(resolve => { resolveWrite = resolve; }));
  let pending!: Promise<boolean>;
  await act(async () => { pending = kind === "matching" ? state.claimMatching(1n) : state.claimUsdc(); });
  expect(state.isClaimingUsdc).toBe(kind === "faucet");
  expect(state.isPending).toBe(kind === "matching");
  expect(host.querySelector("button")!.getAttribute("data-faucet-loading")).toBe(String(kind === "faucet"));
  await act(async () => { resolveWrite(`0x${"a".repeat(64)}`); await pending; });
  expect(state.isClaimingUsdc).toBe(false);
  expect(state.isPending).toBe(false);
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTxFlow } from "@/hooks/useTxFlow";
import { tokenBalanceOptions, tokenMatchesConfigured } from "@/lib/tokenBalance";
import { cancelTransactionFlows } from "@/lib/txToast";

const state = vi.hoisted(() => ({ balance: 0n, chainId: 43113, connected: true, read: vi.fn() }));
vi.mock("@/lib/contracts/addresses", () => ({ TARGET_CHAIN_ID: 43113, usdcAddress: "0xFf56491e29085043DbB11cd01D54cC1449A3d686", ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: state.connected, chainId: state.chainId, status: "connected" }),
  useChainId: () => state.chainId,
  usePublicClient: () => ({ readContract: state.read }),
}));
const owner = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}`;
afterEach(() => { cancelTransactionFlows(); vi.clearAllMocks(); state.connected = true; state.chainId = 43113; });

it.each(["mint", "deposit", "donate", "claim", "refund"])("refreshes the shared mounted balance after a successful %s receipt", async action => {
  state.balance = 0n;
  state.read.mockImplementation(async () => state.balance);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let snapshot: ReturnType<typeof useTokenBalance> | undefined;
  let begin: ReturnType<typeof useTxFlow> | undefined;
  function Probe() { snapshot = useTokenBalance(owner); begin = useTxFlow(); return null; }
  const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
  render();
  // An active observer models the mounted hook's subscription; no mocked invalidation.
  const observer = new QueryObserver(client, tokenBalanceOptions({ readContract: state.read } as unknown as PublicClient, owner));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe(0n));
    render(); expect(snapshot?.balance).toBe(0n);
    state.balance = 1_100_000_000n;
    const flow = begin!(action);
    await flow.wait(async () => ({ transactionHash: hash, status: "success", gasUsed: 21000n, effectiveGasPrice: 160n }));
    render();
    expect(snapshot?.balance).toBe(1_100_000_000n);
    expect(state.read).toHaveBeenLastCalledWith(expect.objectContaining({ address: "0xFf56491e29085043DbB11cd01D54cC1449A3d686", functionName: "balanceOf", args: [owner] }));
    flow.finish();
  } finally { unsubscribe(); client.clear(); }
});

it("does not treat pending, failed, disconnected or wrong-chain reads as a real zero", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let snapshot: ReturnType<typeof useTokenBalance> | undefined;
  function Probe() { snapshot = useTokenBalance(owner); return null; }
  const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
  render(); expect(snapshot).toMatchObject({ balance: undefined, isReady: false, isLoading: true });
  state.read.mockRejectedValueOnce(new Error("RPC unavailable"));
  await expect(client.fetchQuery(tokenBalanceOptions({ readContract: state.read } as unknown as PublicClient, owner))).rejects.toThrow("RPC unavailable");
  render(); expect(snapshot).toMatchObject({ balance: undefined, isReady: false, isError: true });
  state.chainId = 1; render(); expect(snapshot).toMatchObject({ balance: undefined, isEnabled: false });
  state.chainId = 43113; state.connected = false; render(); expect(snapshot?.balance).toBeUndefined();
  client.clear();
});

it("shares cache keys across address casing and rejects a different round token", () => {
  const client = { readContract: state.read } as unknown as PublicClient;
  expect(tokenBalanceOptions(client, owner).queryKey).toEqual(tokenBalanceOptions(client, owner.toUpperCase().replace("0X", "0x") as typeof owner).queryKey);
  expect(tokenMatchesConfigured("0xff56491e29085043dbb11cd01d54cc1449a3d686")).toBe(true);
  expect(tokenMatchesConfigured("0x2222222222222222222222222222222222222222")).toBe(false);
});

it("does not refresh balances for a reverted receipt or a transaction hash before mining", async () => {
  const client = new QueryClient(); const invalidate = vi.spyOn(client, "invalidateQueries");
  let begin: ReturnType<typeof useTxFlow> | undefined;
  function Probe() { begin = useTxFlow(); return null; }
  renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
  const flow = begin!();
  await flow.wait(async () => hash);
  await flow.wait(async () => ({ transactionHash: hash, status: "reverted", gasUsed: 21000n, effectiveGasPrice: 160n }));
  expect(invalidate).not.toHaveBeenCalled(); flow.finish(); client.clear();
});

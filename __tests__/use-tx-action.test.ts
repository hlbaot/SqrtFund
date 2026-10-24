import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useTxAction } from "@/hooks/useTxAction";
import { roundsStore } from "@/lib/store/roundsStore";
import { cancelTransactionFlows, txToast } from "@/lib/txToast";
import { ConfirmationReadError } from "@/lib/txAction";
import { explorerTxUrl } from "@/lib/explorer";
const f = vi.hoisted(() => ({ confirm: vi.fn() }));
const address = `0x${"1".repeat(40)}` as const;
const hash = `0x${"a".repeat(64)}` as const;
vi.mock("@/lib/contracts/addresses", () => ({ TARGET_CHAIN_ID: 43113, factoryAddress: `0x${"f".repeat(40)}` }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: `0x${"2".repeat(40)}`, status: "connected", chainId: 43113 }), useChainId: () => 43113, usePublicClient: () => ({ chain: { id: 43113 } }) }));
vi.mock("@/lib/tokenBalance", () => ({ invalidateTokenBalances: async () => {} }));
vi.mock("@/lib/store/chainSync", async () => {
  const { roundsStore } = await import("@/lib/store/roundsStore");
  return {
    patchReceipt: () => ({ changes: [roundsStore.getState().upsert({ id: `0x${"1".repeat(40)}`, address: `0x${"1".repeat(40)}`, name: "New" }, true)], rounds: [`0x${"1".repeat(40)}`], organizers: [] }),
    readMirrorSnapshot: (...args: unknown[]) => f.confirm(...args),
  };
});
const receipt = { status: "success", transactionHash: hash, gasUsed: 12n, effectiveGasPrice: 15n, blockNumber: 99n, logs: [] };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let begin!: ReturnType<typeof useTxAction>;
  function Probe() { begin = useTxAction(); return null; }
  renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
  return { begin, client };
}
afterEach(() => { cancelTransactionFlows(); txToast.dismiss(); roundsStore.getState().reset(); vi.clearAllMocks(); });
it("the mounted hook patches the store while its pinned-block confirmation is still pending, and attaches real receipt fees", async () => {
  let release!: (publish: () => void) => void;
  f.confirm.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const { begin, client } = mount(); const flow = begin();
  await flow.wait(async () => hash); expect(roundsStore.getState().rounds).toHaveLength(0);
  const waiting = flow.wait(async () => receipt);
  await vi.waitFor(() => expect(roundsStore.getState().rounds[0]?.name).toBe("New"));
  expect(f.confirm).toHaveBeenCalledWith(expect.anything(), [address], [], 99n);
  release(() => roundsStore.getState().hydrate([{ id: address, address, name: "Confirmed" }], Date.now())); await waiting;
  expect(roundsStore.getState().rounds[0].name).toBe("Confirmed");
  flow.toast.success("created", "Created", undefined, hash);
  expect(txToast.getToasts()[0]).toMatchObject({ txHash: hash, feeWei: 180n });
  expect(explorerTxUrl(hash)).toMatch(new RegExp(`/tx/${hash}$`)); flow.finish(); client.clear();
});
it("the mounted hook rolls back a confirmed receipt when verification fails; no false success toast", async () => {
  f.confirm.mockRejectedValue(new Error("RPC offline")); const { begin, client } = mount(); const flow = begin();
  flow.toast.pending("created", "Confirming", undefined, hash);
  const waiting = flow.wait(async () => receipt);
  await expect(waiting).rejects.toBeInstanceOf(ConfirmationReadError);
  expect(roundsStore.getState().rounds).toHaveLength(0);
  flow.error("created", new ConfirmationReadError());
  expect(txToast.getToasts()[0]).toMatchObject({ type: "error", txHash: hash, feeWei: 180n });
  expect(txToast.getToasts()[0].title).toContain("confirmed"); client.clear();
});

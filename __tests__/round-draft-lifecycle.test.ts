import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { copy } from "@/lib/copy";

const f = vi.hoisted(() => ({
  clear: vi.fn(), write: vi.fn(), receipt: vi.fn(), begin: vi.fn(), ready: true, saved: 100_000_000n,
  submit: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
  deposit: undefined as (() => Promise<void>) | undefined,
}));
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useRef: (initial: unknown) => react.useRef(initial === null ? { reportValidity: () => true } : initial) };
});
vi.mock("react/jsx-dev-runtime", async importOriginal => {
  const runtime = await importOriginal<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => {
    const props = args[1] as { onSubmit?: typeof f.submit; onClick?: typeof f.deposit; children?: unknown };
    if (args[0] === "form") f.submit = props.onSubmit;
    if (props?.children === copy.vi.admin.initialPoolDeposit) f.deposit = props.onClick;
    return runtime.jsxDEV(...args);
  } };
});
vi.mock("@/hooks/useFormDraft", () => ({ useFormDraft: () => ({
  ready: f.ready, hasDraft: true, storageError: false,
  values: { roundName: "Student Fund", organizer: "Club", startDateTime: "2030-01-01T10:00", endDateTime: "2030-01-08T10:00", maxMatchPercent: "30", initialPool: "100" },
  setField: vi.fn(), clear: vi.fn(), clearSubmitted: f.clear,
}) }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", chainId: 43113, isConnected: true }),
  usePublicClient: () => ({ readContract: async ({ functionName }: { functionName: string }) => functionName === "allowance" ? 100_000_000n : f.saved,
    waitForTransactionReceipt: f.receipt }),
  useWriteContract: () => ({ writeContractAsync: f.write }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ balance: 1_000_000_000n, isReady: true }) }));
vi.mock("@/hooks/useInitialPoolDeposit", () => ({ useInitialPoolDeposit: () => ({ credit: f.saved, supported: true, canDeposit: true, isError: false, refetch: vi.fn() }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ refetch: vi.fn() }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => f.begin }));
vi.mock("@/lib/context/locale", () => ({ useLocale: () => ({ t: copy.vi, locale: "vi" }) }));
beforeEach(() => {
  vi.clearAllMocks(); f.ready = true; f.saved = 100_000_000n; f.submit = undefined; f.deposit = undefined;
  f.write.mockResolvedValue(`0x${"a".repeat(64)}`); f.receipt.mockResolvedValue({ status: "success" });
  f.begin.mockReturnValue({ wait: async (work: () => Promise<unknown>) => work(),
    toast: { pending: vi.fn(), success: vi.fn() }, finish: vi.fn(), error: vi.fn() });
});
const render = () => renderToStaticMarkup(createElement(CreateRoundForm));
// onSubmit deliberately returns void; drain the promise chain started by act().
const finish = () => vi.waitFor(() => expect(f.begin.mock.results[0]?.value.finish).toHaveBeenCalled());
it("restores visible form values and clears the draft only after creation is confirmed", async () => {
  const html = render();
  expect(html).toContain('value="Student Fund"'); expect(html).toContain('value="2030-01-08T10:00"');
  f.submit!({ preventDefault: vi.fn() }); await finish();
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "createFundedRound" }));
  expect(f.clear).toHaveBeenCalledTimes(1);
  expect(f.clear.mock.invocationCallOrder[0]).toBeGreaterThan(f.receipt.mock.invocationCallOrder[0]);
});
it("keeps the draft after depositing pool funds without creating a round", async () => {
  f.saved = 0n; render();
  expect(f.deposit).toBeTypeOf("function");
  f.deposit!(); await finish();
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "depositInitialPool" }));
  expect(f.clear).not.toHaveBeenCalled();
});
it("keeps the draft if the creation receipt reverts", async () => {
  f.receipt.mockResolvedValue({ status: "reverted" }); render();
  f.submit!({ preventDefault: vi.fn() }); await finish();
  expect(f.clear).not.toHaveBeenCalled();
});
it("does not submit a form before its draft has loaded", async () => {
  f.ready = false; render();
  f.submit!({ preventDefault: vi.fn() });
  expect(f.write).not.toHaveBeenCalled();
  expect(f.clear).not.toHaveBeenCalled();
});

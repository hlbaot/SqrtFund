import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { copy } from "@/lib/copy";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { factoryAddress, usdcAddress } from "@/lib/contracts/addresses";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { txToast } from "@/lib/txToast";

vi.mock("@/lib/contracts/addresses", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/contracts/addresses")>(),
  factoryAddress: `0x${"f".repeat(40)}`,
  usdcAddress: `0x${"3".repeat(40)}`,
}));

const wallet = `0x${"1".repeat(40)}` as const;
const createdRound = `0x${"2".repeat(40)}` as const;
const hash = `0x${"a".repeat(64)}` as const;
const createdReceipt = {
  status: "success", transactionHash: hash, logs: [{
    address: factoryAddress,
    topics: encodeEventTopics({ abi: roundFactoryAbi, eventName: "RoundCreated", args: { roundAddress: createdRound, admin: wallet } }),
    data: encodeAbiParameters([{ type: "address" }, { type: "string" }], [usdcAddress, "Student Fund"]),
  }],
};

const f = vi.hoisted(() => ({
  clear: vi.fn(), write: vi.fn(), receipt: vi.fn(), begin: vi.fn(), ready: true, saved: 100_000_000n,
  submit: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
  deposit: undefined as (() => Promise<void>) | undefined,
  resume: undefined as (() => void) | undefined,
  complete: undefined as (() => void) | undefined,
  progress: { hash: "", round: "" },
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
    if (props?.children === "Kiểm tra giao dịch") f.resume = props.onClick;
    return runtime.jsxDEV(...args);
  } };
});
vi.mock("@/hooks/useFormDraft", () => ({ useFormDraft: (key: string) => key.includes(":round-creation:") ? ({
  ready: true, storageError: false, values: f.progress,
  setField: (field: "hash" | "round", value: string) => { f.progress[field] = value; },
  clear: () => { f.progress = { hash: "", round: "" }; },
}) : ({
  ready: f.ready, hasDraft: true, storageError: false,
  values: { roundName: "Student Fund", organizer: "Club", startDateTime: "2030-01-01T10:00", endDateTime: "2030-01-08T10:00", maxMatchPercent: "30", studentBudget: "10", initialPool: "100" },
  setField: vi.fn(), clear: vi.fn(), clearSubmitted: f.clear,
}) }));
vi.mock("@/components/policy/RoundPolicyPanel", () => ({
  RoundPolicyPanel: ({ roundAddress, onPublished }: { roundAddress: string; onPublished: () => void }) => {
    f.complete = onPublished;
    return createElement("p", null, `Policy for ${roundAddress}`);
  },
}));
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
  f.resume = undefined; f.complete = undefined; f.progress = { hash: "", round: "" };
  f.write.mockResolvedValue(hash); f.receipt.mockResolvedValue(createdReceipt);
  f.begin.mockReturnValue({ wait: async (work: () => Promise<unknown>) => work(),
    toast: { pending: vi.fn(), success: vi.fn() }, finish: vi.fn(), error: vi.fn() });
});
const render = () => renderToStaticMarkup(createElement(CreateRoundForm));
// onSubmit cố ý trả void; chờ hết promise chain do act() khởi tạo.
const finish = () => vi.waitFor(() => expect(f.begin.mock.results[0]?.value.finish).toHaveBeenCalled());
it("opens rules for the created round and reports success only after publication", async () => {
  const success = vi.spyOn(txToast, "success").mockImplementation(() => {});
  const html = render();
  expect(html).toContain('value="Student Fund"'); expect(html).toContain('value="2030-01-08T10:00"');
  f.submit!({ preventDefault: vi.fn() }); await finish();
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "createFundedRound" }));
  expect(f.write.mock.calls[0][0].args.slice(5, 9)).toEqual([1n, 10_000_000n, 3000n, 10_000_000n]);
  expect(f.progress).toEqual({ hash, round: createdRound });
  expect(render()).toContain(`Policy for ${createdRound}`);
  expect(f.clear).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();

  f.complete!();
  expect(f.clear).toHaveBeenCalledTimes(1);
  expect(f.progress).toEqual({ hash: "", round: "" });
  expect(success).toHaveBeenCalledWith("initial-pool-create", copy.vi.toasts.roundCreatedTitle, expect.any(String), hash);
  success.mockRestore();
});
it("resumes a submitted transaction after reload without another deployment or deposit", async () => {
  f.saved = 0n;
  f.progress = { hash, round: "" };
  expect(render()).toContain("Kiểm tra giao dịch tạo vòng");
  f.resume!();
  await finish();
  expect(f.write).not.toHaveBeenCalled();
  expect(f.receipt).toHaveBeenCalledWith(expect.objectContaining({ hash }));
  expect(render()).toContain(`Policy for ${createdRound}`);
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

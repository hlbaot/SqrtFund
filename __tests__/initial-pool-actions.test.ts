import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { factoryAddress } from "@/lib/contracts/addresses";

// A small state harness exercises the real event handlers without a browser wallet.
const f = vi.hoisted(() => ({
  draft: {} as Record<string, string>,
  states: [] as unknown[], cursor: 0, submit: undefined as (() => void) | undefined,
  fields: new Map<string, (event: { target: { value: string } }) => void>(),
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void }>(),
  credit: 0n, saved: 0n, allowance: 0n, balance: 100_000_000n,
  supported: true, isOwner: true, organizer: false, write: vi.fn(), read: vi.fn(), receipt: vi.fn(), error: vi.fn(),
}));
// Funding tests exercise hydrated fields; persistence itself is covered by form-drafts tests.
vi.mock("@/hooks/useFormDraft", () => ({ useFormDraft: (_key: string, defaults: Record<string, string>) => {
  if (!Object.keys(f.draft).length) f.draft = { ...defaults };
  return { ready: true, hasDraft: true, storageError: false, values: f.draft,
    setField: (field: string, value: string) => { f.draft = { ...f.draft, [field]: value }; },
    clear: () => { f.draft = { ...defaults }; }, clearSubmitted: () => { f.draft = { ...defaults }; } };
} }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useState: (initial: unknown) => {
      const index = f.cursor++;
      if (!(index in f.states)) f.states[index] = typeof initial === "function" ? initial() : initial;
      return [f.states[index], (value: unknown) => { f.states[index] = value; }];
    },
    useRef: (initial: unknown) => initial === null ? { current: { reportValidity: () => true } } : actual.useRef(initial),
  };
});
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: true, chainId: 43113 }),
  usePublicClient: () => ({ readContract: f.read, waitForTransactionReceipt: f.receipt }),
  useWriteContract: () => ({ writeContractAsync: f.write }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => {}) }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ refetch: vi.fn() }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ isReady: true, balance: f.balance }) }));
vi.mock("@/hooks/useInitialPoolDeposit", () => ({ useInitialPoolDeposit: () => ({ supported: f.supported, credit: f.credit, isOwner: f.isOwner, canDeposit: f.isOwner || f.organizer, refetch: vi.fn(async () => {}) }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => () => ({
  wait: (fn: () => Promise<unknown>) => fn(), cancelled: false, finish: vi.fn(), error: f.error,
  toast: { pending: vi.fn(), success: vi.fn() },
}) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.vi, locale: "vi" }) }; });
vi.mock("@/components/ui/Input", () => ({ Input: (props: ComponentProps<typeof import("@/components/ui/Input").Input>) => {
  if (props.label && props.onChange) f.fields.set(props.label, props.onChange as never);
  return createElement("div", null, createElement("input", { value: props.value, readOnly: true }), props.suffixElement);
} }));
vi.mock("@/components/ui/Button", () => ({ Button: (props: ComponentProps<typeof import("@/components/ui/Button").Button>) => {
  f.buttons.set(String(props.children), { disabled: props.disabled, onClick: props.onClick as (() => void) | undefined });
  return createElement("button", { type: props.type, disabled: props.disabled }, props.children);
} }));
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
const t = copy.vi;
function Probe() {
  const tree = CreateRoundForm();
  const form = tree.props.children.find((node: { type?: string }) => node?.type === "form");
  f.submit = () => form.props.onSubmit({ preventDefault() {} });
  return tree;
}
function render() { f.cursor = 0; f.buttons.clear(); f.fields.clear(); return renderToStaticMarkup(createElement(Probe)); }
function fill() {
  render();
  const set = (prefix: string, value: string) => {
    const field = [...f.fields].find(([label]) => label.startsWith(prefix));
    if (!field) throw new Error(`Missing field ${prefix}`);
    field[1]({ target: { value } });
  };
  set(t.admin.roundNameLabel, "My funded round");
  set(t.admin.startDateLabel, "2099-01-01T00:00"); set(t.admin.endDateLabel, "2099-01-02T00:00");
  set(t.admin.initialPoolLabel, "25");
  render();
}
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(f, { draft: {}, states: [], cursor: 0, credit: 0n, saved: 0n, allowance: 0n, balance: 100_000_000n, supported: true, isOwner: true, organizer: false });
  f.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === "allowance" ? f.allowance : f.saved);
  f.write.mockImplementation(async ({ functionName }: { functionName: string }) => ({ approve: "0x01", depositInitialPool: "0x02", createFundedRound: "0x03", withdrawInitialPool: "0x04" })[functionName]);
  f.receipt.mockImplementation(async ({ hash }: { hash: string }) => {
    if (hash === "0x02") f.credit = f.saved = 25_000_000n;
    if (hash === "0x03" || hash === "0x04") f.credit = f.saved = 0n;
    return { status: "success" };
  });
});
it("deposits first and never creates a round from the deposit button", async () => {
  fill(); expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(true);
  f.buttons.get(t.admin.initialPoolDeposit)!.onClick!();
  await vi.waitFor(() => expect(f.credit).toBe(25_000_000n));
  expect(f.write.mock.calls.map(([args]) => args.functionName)).toEqual(["approve", "depositInitialPool"]);
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "approve", args: [factoryAddress, 25_000_000n] }));
  const html = render();
  expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(false);
  expect(f.buttons.get(t.admin.initialPoolConfirmed)?.disabled).toBe(true);
  expect(html).toContain(t.admin.initialPoolReadyToCreate);
});
it("waits for deposit confirmation rather than unlocking after a submitted hash", async () => {
  fill();
  let confirmDeposit!: (receipt: { status: string }) => void;
  f.receipt.mockImplementation(async ({ hash }: { hash: string }) => hash === "0x02"
    ? new Promise(resolve => { confirmDeposit = resolve; }) : { status: "success" });
  f.buttons.get(t.admin.initialPoolDeposit)!.onClick!();
  await vi.waitFor(() => expect(confirmDeposit).toBeTypeOf("function"));
  render(); expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(true);
  expect(f.credit).toBe(0n);
  confirmDeposit({ status: "reverted" });
  await vi.waitFor(() => expect(f.error).toHaveBeenCalled());
  expect(f.write.mock.calls.map(([args]) => args.functionName)).not.toContain("createFundedRound");
});
it("recovers credit after reload and creates without a second deposit or wallet balance", async () => {
  f.credit = f.saved = 25_000_000n; f.balance = 0n;
  fill(); expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(false);
  f.submit!();
  await vi.waitFor(() => expect(f.write).toHaveBeenCalled());
  expect(f.write.mock.calls.map(([args]) => args.functionName)).toEqual(["createFundedRound"]);
  expect(f.write.mock.calls[0][0].args.at(-1)).toBe(25_000_000n);
});
it("refunds credit even when the form is incomplete and ownership has changed", async () => {
  f.credit = f.saved = 25_000_000n; f.isOwner = false;
  render(); f.buttons.get(t.admin.initialPoolWithdraw)!.onClick!();
  await vi.waitFor(() => expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "withdrawInitialPool" })));
});

it("submits the organizer's chosen student budget for on-chain enforcement", async () => {
  f.credit = f.saved = 25_000_000n;
  fill();
  f.fields.get(t.admin.maxPerRoundLabel)!({ target: { value: "12.5" } });
  render();
  f.submit!();
  await vi.waitFor(() => expect(f.write).toHaveBeenCalled());
  const args = f.write.mock.calls[0][0].args;
  expect(args[6]).toBe(12_500_000n);
  expect(args[8]).toBe(12_500_000n);
});

it("blocks round creation with an invalid student budget", () => {
  f.credit = f.saved = 25_000_000n;
  fill();
  f.fields.get(t.admin.maxPerRoundLabel)!({ target: { value: "0" } });
  render();
  expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(true);
  f.submit!();
  expect(f.write).not.toHaveBeenCalled();
});

it("rechecks credit before create when another tab has withdrawn it", async () => {
  f.credit = 25_000_000n; f.saved = 0n;
  fill(); f.submit!();
  await vi.waitFor(() => expect(f.error).toHaveBeenCalled());
  expect(f.write).not.toHaveBeenCalled();
});
it("approval rejection never deposits or creates a round", async () => {
  fill(); f.write.mockRejectedValueOnce(new Error("Rejected"));
  f.buttons.get(t.admin.initialPoolDeposit)!.onClick!();
  await vi.waitFor(() => expect(f.error).toHaveBeenCalled());
  expect(f.write.mock.calls.map(([args]) => args.functionName)).toEqual(["approve"]);
  render(); expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(true);
});
it("deposits only the missing amount and ignores double clicks", async () => {
  f.credit = f.saved = 10_000_000n;
  fill(); const click = f.buttons.get(t.admin.initialPoolDeposit)!.onClick!;
  click(); click();
  await vi.waitFor(() => expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "depositInitialPool", args: expect.arrayContaining([15_000_000n]) })));
  expect(f.write.mock.calls.map(([args]) => args.functionName)).toEqual(["approve", "depositInitialPool"]);
});

it("lets an authorized Organizer deposit before creating while keeping the same order", async () => {
  f.isOwner = false; f.organizer = true;
  fill(); expect(f.buttons.get(t.admin.initialPoolDeposit)?.disabled).toBe(false);
  expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(true);
  f.buttons.get(t.admin.initialPoolDeposit)!.onClick!();
  await vi.waitFor(() => expect(f.credit).toBe(25_000_000n));
  expect(f.write.mock.calls.map(([args]) => args.functionName)).toEqual(["approve", "depositInitialPool"]);
  render(); expect(f.buttons.get(t.admin.createRoundBtn)?.disabled).toBe(false);
});

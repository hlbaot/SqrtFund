import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { ProjectForm } from "@/components/project/ProjectForm";
import RegisterPage from "@/app/register/page";
import { RegisterView } from "@/views/register";

const f = vi.hoisted(() => ({
  selected: undefined as Address | undefined, rounds: [] as { address: Address; number: number; name: string }[],
  loading: false, error: false, unavailable: false, readError: false, wrongTarget: false,
  endTime: 2000n, chainId: 43113, fill: false, emptyStates: 0,
  connected: true, draftReady: true, clearDraft: vi.fn(),
  submit: undefined as ((event: { preventDefault: () => void }) => Promise<unknown>) | undefined,
  write: vi.fn(), receipt: vi.fn(), role: vi.fn(), round: vi.fn(), initial: vi.fn(), begin: vi.fn(),
}));
const first = `0x${"1".repeat(40)}` as Address;
const second = `0x${"2".repeat(40)}` as Address;
vi.mock("@/hooks/useFormDraft", () => ({ useFormDraft: (_key: string, defaults: Record<string, string>) => ({
  ready: f.draftReady, hasDraft: f.fill, storageError: false,
  values: f.fill && "name" in defaults ? { ...defaults, name: "Robotics club", description: "A detailed project description", contactUrl: "https://example.test" } : defaults,
  setField: vi.fn(), clear: vi.fn(), clearSubmitted: f.clearDraft,
}) }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual,
    useState: (initial: unknown) => {
      const values = ["Robotics club", "A detailed project description", "https://example.test", ""];
      return actual.useState(f.fill && initial === "" ? values[f.emptyStates++] : initial);
    },
  };
});
vi.mock("react/jsx-dev-runtime", async importOriginal => {
  const actual = await importOriginal<typeof import("react/jsx-dev-runtime")>();
  return { ...actual, jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
    if (args[0] === "form") f.submit = (args[1] as { onSubmit?: typeof f.submit })?.onSubmit;
    return actual.jsxDEV(...args);
  } };
});
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: `0x${"3".repeat(40)}`, isConnected: f.connected, chainId: f.chainId }),
  usePublicClient: () => ({ waitForTransactionReceipt: f.receipt }),
  useWriteContract: () => ({ writeContractAsync: f.write }),
}));
vi.mock("@/hooks/useRegistrationRounds", () => ({ useRegistrationRounds: (initial?: string) => {
  f.initial(initial);
  return { roundAddress: f.selected, rounds: f.rounds, isLoading: f.loading, isError: f.error,
    selectionUnavailable: f.unavailable, selectedReadError: f.readError, selectRound: vi.fn(), refetch: vi.fn() };
} }));
vi.mock("@/hooks/useRound", () => ({ useRound: (address?: string) => {
  f.round(address);
  return { roundAddress: f.wrongTarget ? first : address, endTime: f.endTime, status: "open", isCancelled: false,
    isLoading: false, isError: false, refetch: vi.fn() };
} }));
vi.mock("@/hooks/useRole", () => ({ useRole: (address?: string) => { f.role(address); return { isStudent: true, canParticipate: true }; } }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => f.begin }));
vi.mock("@/components/project/ProjectCard", () => ({ ProjectCard: () => null }));
vi.mock("@/components/verify/StudentAccessGate", () => ({ StudentAccessGate: () => null }));
vi.mock("@/components/layout/ConnectWalletButton", () => ({ ConnectWalletButton: () => createElement("button", null, "Kết nối ví") }));
vi.mock("@/components/common/AOSInit", () => ({ AOSInit: () => null }));
vi.mock("@/hooks/useStudentStatus", () => ({ useStudentStatus: () => ({ isStudent: true, isLoading: false }) }));
vi.mock("@/lib/seo.server", () => ({ pageMetadata: vi.fn() }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(f, { connected: true, selected: undefined, rounds: [], loading: false, error: false, unavailable: false,
    readError: false, wrongTarget: false, endTime: 2000n, chainId: 43113, fill: false, emptyStates: 0, submit: undefined, draftReady: true });
  vi.spyOn(Date, "now").mockReturnValue(1000_000);
  f.write.mockResolvedValue(`0x${"a".repeat(64)}`);
  f.receipt.mockResolvedValue({ status: "success" });
  f.begin.mockReturnValue({ wait: async (work: () => Promise<unknown>) => work(),
    toast: { pending: vi.fn(), success: vi.fn() }, finish: vi.fn(), error: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());
const render = (initialRound?: string) => renderToStaticMarkup(createElement(ProjectForm, { initialRound }));
it("hides the registration page until a wallet is connected even with cached Student status", () => {
  f.connected = false;
  const html = renderToStaticMarkup(createElement(RegisterView));
  expect(html).toContain("Kết nối ví");
  expect(html).not.toContain("Đăng ký dự án sinh viên");
  expect(html).not.toContain("<form");
  expect(f.initial).not.toHaveBeenCalled();
});
function chooseSecond() {
  f.selected = second;
  f.rounds = [{ address: second, number: 2, name: "Student fund" }, { address: first, number: 1, name: "Older fund" }];
}
it("shows an honest empty state without the Student warning or a submission form", () => {
  const html = render();
  expect(html).toContain("Chưa có vòng tài trợ nào đang mở đăng ký");
  expect(html).not.toContain("Hãy chọn vòng dùng registry chung");
  expect(html).not.toContain("Yêu cầu xác minh sinh viên");
  expect(html).not.toContain('<form');
});
it("distinguishes loading and RPC errors from an empty round list", () => {
  f.loading = true;
  expect(render()).toContain("Đang tải các vòng tài trợ");
  f.loading = false; f.error = true;
  const html = render();
  expect(html).toContain("Không tải được danh sách vòng tài trợ");
  expect(html).not.toContain("Chưa có vòng tài trợ nào đang mở đăng ký");
});
it("uses the chosen round for both contract reads and Student eligibility", () => {
  chooseSecond();
  const html = render(second);
  expect(f.initial).toHaveBeenCalledWith(second);
  expect(f.round).toHaveBeenCalledWith(second);
  expect(f.role).toHaveBeenCalledWith(second);
  expect(html).toContain('id="registration-round"');
  expect(html).toContain("Student fund");
  expect(html).toContain(`<option value="${second}" selected=""`);
});
it("does not display the form for an unavailable explicit round", () => {
  f.unavailable = true; f.rounds = [{ address: first, number: 1, name: "Other fund" }];
  const html = render(second);
  expect(html).toContain("Vòng được yêu cầu hiện không nhận đăng ký");
  expect(html).not.toContain('<form');
});
it("writes registerProject to the selected contract on Fuji", async () => {
  chooseSecond(); f.fill = true; render(second);
  expect(f.submit).toBeTypeOf("function");
  await f.submit!({ preventDefault: vi.fn() });
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({
    address: second, chainId: 43113, functionName: "registerProject",
    args: ["Robotics club", "A detailed project description", "", "https://example.test"],
  }));
  expect(f.clearDraft).toHaveBeenCalledTimes(1);
  expect(f.clearDraft.mock.invocationCallOrder[0]).toBeGreaterThan(f.receipt.mock.invocationCallOrder[0]);
});
it("keeps the draft when the wallet rejects or the receipt reverts", async () => {
  for (const failure of ["wallet", "receipt"]) {
    vi.clearAllMocks(); chooseSecond(); f.fill = true;
    f.begin.mockReturnValue({ wait: async (work: () => Promise<unknown>) => work(), toast: { pending: vi.fn(), success: vi.fn() }, finish: vi.fn(), error: vi.fn() });
    f.write.mockResolvedValue(`0x${"a".repeat(64)}`);
    f.receipt.mockResolvedValue({ status: "success" });
    if (failure === "wallet") f.write.mockRejectedValueOnce(new Error("Rejected"));
    else f.receipt.mockResolvedValueOnce({ status: "reverted" });
    render(second);
    await f.submit!({ preventDefault: vi.fn() });
    expect(f.clearDraft).not.toHaveBeenCalled();
  }
});
it("blocks submission until the correct scoped draft has loaded", async () => {
  chooseSecond(); f.fill = true; f.draftReady = false; render(second);
  await f.submit!({ preventDefault: vi.fn() });
  expect(f.write).not.toHaveBeenCalled();
});
it.each(["expired", "wrong-network", "wrong-target"])("blocks a stale or invalid submission: %s", async reason => {
  chooseSecond(); f.fill = true;
  if (reason === "expired") f.endTime = 1000n;
  if (reason === "wrong-network") f.chainId = 1;
  if (reason === "wrong-target") f.wrongTarget = true;
  render(second);
  await f.submit!({ preventDefault: vi.fn() });
  expect(f.write).not.toHaveBeenCalled();
});
it("passes a requested round from the page URL to the registration view", async () => {
  const page = await RegisterPage({ searchParams: Promise.resolve({ round: second }) });
  expect(page.props.initialRound).toBe(second);
});

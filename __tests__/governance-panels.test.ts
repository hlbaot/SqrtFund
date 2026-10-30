// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { RoundPolicyPanel } from "@/components/policy/RoundPolicyPanel";
import { ReviewOutcomePanel } from "@/components/policy/ReviewOutcomePanel";
import { ProjectModerationDialog } from "@/components/admin/ProjectModerationDialog";
import { RULES_VERSION, type GovernanceRecord } from "@/lib/roundGovernance";
const f = vi.hoisted(() => ({ records: [] as GovernanceRecord[], error: false, count: 0n, owner: true, publish: vi.fn(), refetch: vi.fn() }));
const round = `0x${"1".repeat(40)}` as const;
const owner = `0x${"2".repeat(40)}`;
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: f.owner, address: owner, chainId: 43113 }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ admin: owner, projectCount: f.count, status: "open", finalized: false, isCancelled: false, isLoading: false, isError: false }) }));
vi.mock("@/hooks/useRoundGovernance", () => ({ useRoundGovernance: () => ({ data: f.records, isError: f.error, refetch: f.refetch }), usePublishGovernance: () => f.publish }));
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.clearAllMocks(); Object.assign(f, { records: [], error: false, count: 0n, owner: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("only offers initial policy publication to the owner before any project exists", async () => {
  await act(async () => root.render(createElement(RoundPolicyPanel, { roundAddress: round })));
  expect(host.querySelector("form")).not.toBeNull();
  f.count = 1n;
  await act(async () => root.render(createElement(RoundPolicyPanel, { roundAddress: round })));
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("Không thể công bố tiêu chí mới");
  f.count = 0n; f.owner = false;
  await act(async () => root.render(createElement(RoundPolicyPanel, { roundAddress: round })));
  expect(host.querySelector("form")).toBeNull();
});
it("shows the signed immutable policy and suppresses editing even for the organizer", async () => {
  f.records = [{ id: 1, kind: "policy", payload: { kind: "policy", round, rulesVersion: RULES_VERSION, policy: { theme: "Student robotics", eligibility: "All students", funding: "Hardware", criteria: "Working prototype" } }, owner_address: owner, transaction_hash: null, created_at: "2026-10-30T00:00:00Z" }];
  await act(async () => root.render(createElement(RoundPolicyPanel, { roundAddress: round })));
  expect(host.textContent).toContain("Working prototype");
  expect(host.textContent).toContain("khóa chỉnh sửa");
  expect(host.querySelector("form")).toBeNull();
});
it("distinguishes unavailable criteria from an unpublished policy and offers retry", async () => {
  f.error = true;
  await act(async () => root.render(createElement(RoundPolicyPanel, { roundAddress: round })));
  expect(host.textContent).toContain("Chưa đọc được tiêu chí");
  expect(host.textContent).not.toContain("Organizer chưa công bố");
  expect(host.querySelector("form")).toBeNull();
  await act(async () => host.querySelector("button")!.click());
  expect(f.refetch).toHaveBeenCalledOnce();
});
it("shows a receipt-backed rejection reason without offering another decision", async () => {
  f.records = [{ id: 2, kind: "review", payload: { kind: "review", round, rulesVersion: RULES_VERSION, review: { projectId: "1", action: "reject", criteria: ["budget"], reason: "Please itemize material expenses" } }, owner_address: owner, transaction_hash: `0x${"a".repeat(64)}`, created_at: "2026-10-30T00:00:00Z" }];
  await act(async () => root.render(createElement(ReviewOutcomePanel, { roundAddress: round, projectId: "1", rejected: true })));
  expect(host.textContent).toContain("Please itemize material expenses");
  expect(host.querySelector("a")?.href).toContain("/tx/0x");
  expect(host.querySelector("form")).toBeNull();
});
it("does not present a mismatched explanation as the confirmed outcome", async () => {
  f.records = [{ id: 2, kind: "review", payload: { kind: "review", round, rulesVersion: RULES_VERSION, review: { projectId: "1", action: "approve", criteria: ["fit"], reason: "DO NOT SHOW" } }, owner_address: owner, transaction_hash: `0x${"a".repeat(64)}`, created_at: "2026-10-30T00:00:00Z" }];
  await act(async () => root.render(createElement(ReviewOutcomePanel, { roundAddress: round, projectId: "1", rejected: true })));
  expect(host.textContent).not.toContain("DO NOT SHOW");
  expect(host.textContent).toContain("Chưa có lời giải thích");
});
it("requires a criterion and explanation before confirming moderation", async () => {
  const confirm = vi.fn();
  await act(async () => root.render(createElement(ProjectModerationDialog, { project: { name: "Test", ownerAddress: owner, description: "Test", contactUrl: "https://example.com" }, action: "reject", roundAddress: round, pending: false, phase: "idle", onClose: vi.fn(), onConfirm: confirm })));
  const dialog = document.querySelector('[role="dialog"]')!;
  const button = Array.from(dialog.querySelectorAll("button")).at(-1)!;
  expect(button.disabled).toBe(true);
  await act(async () => (dialog.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect(button.disabled).toBe(true);
  const input = dialog.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Outside the round theme");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(confirm).toHaveBeenCalledWith({ criteria: ["fit"], reason: "Outside the round theme" });
});

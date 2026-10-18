import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { projectModerationState, safeProjectLink } from "@/lib/projectModeration";
import { ProjectModerationActions } from "@/components/admin/ProjectModerationActions";
import { ProjectModerationDialog } from "@/components/admin/ProjectModerationDialog";
import { PendingProjectCard } from "@/components/admin/PendingProjectCard";
import { copy } from "@/lib/copy";
import { projectReviewCopy } from "@/lib/projectReview";
const locale = vi.hoisted(() => ({ value: "vi" as "vi" | "en" }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: locale.value, t: copy[locale.value] }) }; });
// Exercise dialog content without a browser portal; the app uses the existing Dialog focus trap.
vi.mock("@/components/ui/Dialog", () => ({ Dialog: ({ children, title }: { children: import("react").ReactNode; title: string }) => createElement("section", { role: "dialog" }, createElement("h2", null, title), children) }));
const owner = "0x123456789012345678901234567890123456abcd";
const viewer = "0x1111111111111111111111111111111111111111";
const roundAddress = "0x2222222222222222222222222222222222222222";
const project = { id: "0", approved: false, rejected: false, ownerAddress: owner, name: "Student robot club", description: "Robotics workshop for students", contactUrl: "https://example.com/club" };
const round = { admin: viewer, endTime: 2000n, finalized: false, isCancelled: false, supportsRejection: true };
it.each([
  ["admin before deadline", {}, {}, viewer, 1999, true, true],
  ["not admin", {}, {}, owner, 1000, false, false],
  ["disconnected", {}, {}, undefined, 1000, false, false],
  ["approved", { approved: true }, {}, viewer, 1000, false, false],
  ["rejected", { rejected: true }, {}, viewer, 1000, false, false],
  ["at deadline", {}, {}, viewer, 2000, false, false],
  ["after deadline", {}, {}, viewer, 2001, false, false],
  ["finalized", {}, { finalized: true }, viewer, 1000, false, false],
  ["cancelled", {}, { isCancelled: true }, viewer, 1000, false, false],
  ["old round", {}, { supportsRejection: false }, viewer, 1000, true, false],
  ["before hydration", {}, {}, viewer, 0, false, false],
] as const)("permission conditions: %s", (_, patch, roundPatch, wallet, now, approve, reject) => {
  const result = projectModerationState({ ...project, ...patch }, { ...round, ...roundPatch }, wallet, now);
  expect(result.canApprove).toBe(approve); expect(result.canReject).toBe(reject); expect(result.showActions).toBe(approve);
});
it("keeps the legacy note below the responsive action group and hides reject", () => {
  const html = renderToStaticMarkup(createElement(ProjectModerationActions, { project, round: { ...round, supportsRejection: false }, viewer, now: 1000, pending: false, onAction: vi.fn() }));
  expect(html).toContain("flex-col gap-2 sm:flex-row"); expect(html).toContain("w-full");
  expect(html).not.toContain(copy[locale.value].rejection.action);
  expect(html.indexOf(copy[locale.value].moderation.legacy)).toBeGreaterThan(html.indexOf("</button>"));
});
it.each(["vi", "en"] as const)("renders full project and round identity and action warnings in %s", value => {
  locale.value = value;
  for (const action of ["approve", "reject"] as const) {
    const html = renderToStaticMarkup(createElement(ProjectModerationDialog, { project, action, roundName: "Autumn student fund", roundAddress, pending: false, phase: "idle", onClose: vi.fn(), onConfirm: vi.fn() }));
    expect(html).toContain(project.name); expect(html).toContain(owner); expect(html).toContain(`title="${owner}"`); expect(html).toContain(project.description); expect(html).toContain(`href="${project.contactUrl}"`);
    expect(html).toContain("Autumn student fund"); expect(html).toContain(roundAddress); expect(html).toContain(copy[value].common.copyAddress);
    expect(html).toContain(action === "approve" ? copy[value].moderation.approveTitle : copy[value].moderation.rejectTitle);
    expect(html).toContain(action === "approve" ? copy[value].moderation.approveWarning : copy[value].rejection.confirm);
  }
});
it("blocks modal confirmation when the clock crosses the deadline and retains clear errors", () => {
  locale.value = "vi";
  const state = projectModerationState(project, round, viewer, 2000);
  const html = renderToStaticMarkup(createElement(ProjectModerationDialog, { project, action: "approve", roundAddress, pending: false, phase: "idle", blockedReason: copy.vi.moderation[state.reason!], error: "Dự án này đã được Admin duyệt trước đó.", onClose: vi.fn(), onConfirm: vi.fn() }));
  expect(html).toContain(copy.vi.moderation.expired); expect(html).toContain('role="alert"');
  const confirm = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match => match[2].includes(copy.vi.moderation.confirmApprove));
  expect(confirm?.[1]).toMatch(/\sdisabled(?:=|\s|$)/);
});
it("shows a locked loading confirmation while awaiting a wallet signature", () => {
  const html = renderToStaticMarkup(createElement(ProjectModerationDialog, { project, action: "reject", pending: true, phase: "signing", onClose: vi.fn(), onConfirm: vi.fn() }));
  expect(html).toContain(copy[locale.value].moderation.signing); expect(html).toContain("animate-spin");
  const confirm = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match => match[2].includes(copy[locale.value].moderation.signing));
  expect(confirm?.[1]).toMatch(/\sdisabled(?:=|\s|$)/);
});
it("does not create executable project links from unsafe protocols", () => {
  expect(safeProjectLink("javascript:alert(1)")).toBeUndefined(); expect(safeProjectLink("https://example.com/club")).toBe("https://example.com/club");
});

it("groups both review actions beside collapsed project identity", () => {
  locale.value = "vi";
  const html = renderToStaticMarkup(createElement(PendingProjectCard, { project, round, viewer, now: 1000, pending: false, expanded: false, onToggle: vi.fn(), onAction: vi.fn() }));
  expect(html).toContain("<article");
  expect(html).toContain(project.name);
  expect(html).toContain(owner);
  expect(html).toContain(`href="${project.contactUrl}"`);
  expect(html).toContain(copy.vi.admin.approveBtn);
  expect(html).toContain(copy.vi.rejection.action);
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('hidden=""');
});

it("replaces the entire card action group with the deadline explanation", () => {
  const html = renderToStaticMarkup(createElement(PendingProjectCard, { project, round, viewer, now: 2000, pending: false, expanded: true, onToggle: vi.fn(), onAction: vi.fn() }));
  expect(html).toContain(projectReviewCopy.vi.ended);
  expect(html).toContain(projectReviewCopy.vi.expiredBadge);
  expect(html).not.toContain('data-variant="accent"');
  expect(html).not.toContain('data-variant="destructive"');
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PendingProjectCard } from "@/components/admin/PendingProjectCard";
import { ProjectReviewList, ProjectReviewResults } from "@/components/admin/ProjectReviewList";
import { filterReviewProjects, projectReviewCopy, projectReviewStatus } from "@/lib/projectReview";
import { StatusAlert } from "@/components/ui/StatusAlert";

const locale = vi.hoisted(() => ({ value: "vi" as "vi" | "en" }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: locale.value, t: copy[locale.value] }) }; });
const admin = "0x1111111111111111111111111111111111111111";
const round = { admin, endTime: 2000n, finalized: false, isCancelled: false, supportsRejection: true };
const project = { id: "0", name: "Robot club", ownerAddress: "0x1CcbD6684cd9Fa50905fd7E9de980d0D03Ce388b", description: "Full project description\nWith a second paragraph.", contactUrl: "https://example.org/robot", approved: false, rejected: false };
const projects = [project, { ...project, id: "1", name: "Scholarship", ownerAddress: admin, approved: true }, { ...project, id: "2", name: "Solar lab", rejected: true }];
const actions = { round, viewer: admin, now: 1000, pending: false, onAction: vi.fn() };
const card = { ...actions, project, onToggle: vi.fn() };
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("project review status and filters", () => {
  it("searches names and complete wallet addresses without case sensitivity", () => {
    expect(filterReviewProjects(projects, "  ROBOT  ", "all", round, 1000)).toEqual([project]);
    expect(filterReviewProjects(projects, admin.toUpperCase(), "all", round, 1000).map(p => p.id)).toEqual(["1"]);
    expect(filterReviewProjects(projects, "missing", "all", round, 1000)).toEqual([]);
  });
  it("combines status filters with search and keeps approved/rejected status after expiry", () => {
    for (const [filter, id] of [["pending", "0"], ["approved", "1"], ["rejected", "2"]] as const) expect(filterReviewProjects(projects, "", filter, round, 1000).map(p => p.id)).toEqual([id]);
    expect(filterReviewProjects(projects, "robot", "approved", round, 1000)).toEqual([]);
    expect(projectReviewStatus(project, round, 1999)).toBe("pending");
    expect(projectReviewStatus(project, round, 2000)).toBe("expired");
    expect(filterReviewProjects(projects, "", "expired", round, 2000)).toEqual([project]);
    expect(projectReviewStatus(projects[1], round, 2000)).toBe("approved");
    expect(projectReviewStatus(projects[2], round, 2000)).toBe("rejected");
  });
});

it.each([false, true])("renders accessible accordion expanded=%s and separate copy buttons", expanded => {
  const html = render(createElement(PendingProjectCard, { ...card, expanded }));
  expect(html).toContain(`aria-expanded="${expanded}"`);
  expect(html).toContain("aria-controls=");
  expect(html.includes('hidden=""')).toBe(!expanded);
  expect(html).toContain(project.description);
  expect(html).toContain(project.ownerAddress);
  expect(html).toContain("0x1CcbD6...388b");
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain("focus-visible:ring-2");
});

it.each(["vi", "en"] as const)("renders expired alert and removes transaction buttons in %s", value => {
  locale.value = value;
  const html = render(createElement(PendingProjectCard, { ...card, expanded: true, now: 2000 }));
  const c = projectReviewCopy[value];
  expect(html).toContain(c.expiredBadge); expect(html).toContain(c.ended); expect(html).toContain(c.endedDetail);
  expect(html).toContain('role="status"'); expect(html).toContain("border-l-[3px]"); expect(html).toContain("text-amber-100");
  expect(html).not.toContain('data-variant="accent"'); expect(html).not.toContain('data-variant="destructive"');
});

it("renders legacy info alert while retaining only approval", () => {
  const html = render(createElement(PendingProjectCard, { ...card, expanded: true, round: { ...round, supportsRejection: false } }));
  expect(html).toContain("text-blue-100");
  expect(html).toContain('data-variant="accent"'); expect(html).not.toContain('data-variant="destructive"');
});

it("renders the toolbar, available status filters and result count", () => {
  locale.value = "vi";
  const html = render(createElement(ProjectReviewList, { ...actions, projects, isLoading: false }));
  expect(html).toContain('type="search"'); expect(html).toContain(projectReviewCopy.vi.filter);
  expect(html).toContain('value="approved"'); expect(html).toContain('value="rejected"');
  expect(html).toContain("Hiển thị 3 / 3 dự án");
});

it("omits unavailable reviewed filters", () => {
  const html = render(createElement(ProjectReviewList, { ...actions, projects: [project], isLoading: false }));
  expect(html).not.toContain('value="approved"'); expect(html).not.toContain('value="rejected"');
});

const results = { ...actions, isLoading: false, expanded: new Set<string>(), onToggle: vi.fn() };
it("distinguishes an empty queue from no search/filter matches", () => {
  for (const isFiltered of [false, true]) {
    const html = render(createElement(ProjectReviewResults, { ...results, projects: [], isFiltered }));
    expect(html).toContain(isFiltered ? projectReviewCopy.vi.noResults : projectReviewCopy.vi.empty);
  }
});

it("renders search/filter results after applying both constraints", () => {
  const matches = filterReviewProjects(projects, "solar", "rejected", round, 1000);
  const html = render(createElement(ProjectReviewResults, { ...results, projects: matches, isFiltered: true }));
  expect(html).toContain("Solar lab"); expect(html).not.toContain("Robot club"); expect(html).not.toContain("Scholarship");
});

it("constrains a 50-project list and provides a focusable scroll region and responsive grid", () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ ...project, id: String(i), name: `Project ${i}` }));
  const html = render(createElement(ProjectReviewResults, { ...results, projects: many, isFiltered: false }));
  expect(html.match(/<article\b/g)).toHaveLength(50);
  expect(html).toContain("max-h-[70vh]"); expect(html).toContain("overflow-y-auto"); expect(html).toContain("lg:grid-cols-2"); expect(html).toContain('tabindex="0"');
});

it("shows loading skeletons instead of a false empty queue", () => {
  const html = render(createElement(ProjectReviewList, { ...actions, projects: [], isLoading: true }));
  expect(html).toContain(projectReviewCopy.vi.loading); expect(html).toContain('aria-busy="true"'); expect(html).toContain("animate-pulse"); expect(html).not.toContain(projectReviewCopy.vi.empty);
});

it("keeps RPC errors distinct from an empty queue", () => {
  const html = render(createElement(ProjectReviewList, { ...actions, projects: [], isLoading: false, isError: true, onRetry: vi.fn() }));
  expect(html).toContain(projectReviewCopy.vi.readError); expect(html).not.toContain(projectReviewCopy.vi.empty);
});

it.each(["info", "warning", "error", "success"] as const)("renders reusable %s status alert", tone => {
  const html = render(createElement(StatusAlert, { tone, title: "Status" }, "Details"));
  expect(html).toContain('role="status"'); expect(html).toContain("Status"); expect(html).toContain("Details");
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectReviewList } from "@/components/admin/ProjectReviewList";

const state = vi.hoisted(() => ({ page: 1 }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === 1 ? state.page : initial) };
});
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
const admin = `0x${"1".repeat(40)}`;
const projects = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1), name: `Project ${index + 1}`, ownerAddress: admin,
  description: "", contactUrl: "", approved: false, rejected: false,
}));
const props = {
  round: { admin, endTime: 2000n, finalized: false, isCancelled: false, supportsRejection: true },
  viewer: admin, now: 1000, pending: false, onAction: vi.fn(), isLoading: false,
};
const render = (overrides = {}) => renderToStaticMarkup(createElement(ProjectReviewList, { ...props, projects, ...overrides }));
const names = (html: string) => [...html.matchAll(/<span[^>]*title="Project (\d+)"/g)].map(match => Number(match[1]));
beforeEach(() => { state.page = 1; });

it("shows the latest four registrations, sorting IDs numerically", () => {
  const html = render();
  expect(names(html)).toEqual([10, 9, 8, 7]);
  expect(html).toContain("Hiển thị 4 / 10 dự án");
  expect(html).toContain('aria-label="Trang 1" aria-current="page"');
  expect(html).toContain('aria-label="Trang 3"');
});
it("shows the next four projects on page two without repeating page one", () => {
  state.page = 2;
  expect(names(render())).toEqual([6, 5, 4, 3]);
});
it("shows only the remaining projects on the last page", () => {
  state.page = 3;
  expect(names(render())).toEqual([2, 1]);
});
it("clamps an out-of-range page when the result set shrinks", () => {
  state.page = 3;
  const html = render({ projects: projects.slice(0, 5) });
  expect(names(html)).toEqual([1]);
  expect(html).toContain('aria-label="Trang 2" aria-current="page"');
});
it("hides pagination when at most four projects remain", () => {
  const html = render({ projects: projects.slice(0, 4) });
  expect(names(html)).toEqual([4, 3, 2, 1]);
  expect(html).not.toContain('<nav');
});
it("does not display page controls during loading or RPC errors", () => {
  for (const overrides of [{ isLoading: true }, { isError: true }]) {
    const html = render(overrides);
    expect(html).not.toContain('<nav');
    expect(names(html)).toEqual([]);
  }
});

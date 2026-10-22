import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { PlatformDashboard } from "@/components/admin/PlatformDashboard";

const f = vi.hoisted(() => ({ page: 1, count: 6 }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === 1 ? f.page : initial) };
});
vi.mock("wagmi", () => ({
  useAccount: () => ({}), usePublicClient: () => undefined,
  useWriteContract: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/lib/organizerRegistry", () => ({ loadOrganizerRegistry: async () => [] }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useOrganizerApplicationsAdmin: () => ({
  // Deliberately oldest first: the dashboard must show the latest submissions first.
  applications: Array.from({ length: f.count }, (_, index) => ({
    id: `app-${index + 1}`, organizationName: `Organization ${index + 1}`,
    walletAddress: `0x${"1".repeat(40)}`, contactEmail: "fixture@example.test",
    status: "pending", reason: "Organize funding",
    createdAt: `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
  })), pendingCount: 0,
}) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});

beforeEach(() => { f.page = 1; f.count = 6; });
const render = () => renderToStaticMarkup(createElement(PlatformDashboard, { isPlatformOwner: true }));
const rows = (html: string) => [...html.matchAll(/Organization (\d+)/g)].map(match => Number(match[1]));

it("shows only the four latest applications on page one", () => {
  const html = render();
  expect(rows(html)).toEqual([6, 5, 4, 3]);
  expect(html).toContain('aria-label="Trang 1" aria-current="page"');
  expect(html).toContain('aria-label="Trang 2"');
});
it("shows the remaining applications on page two", () => {
  f.page = 2;
  const html = render();
  expect(rows(html)).toEqual([2, 1]);
  expect(html).toContain('aria-label="Trang 2" aria-current="page"');
});
it("keeps a valid page when filtering or reviewing reduces the list", () => {
  f.page = 3;
  const html = render();
  expect(rows(html)).toEqual([2, 1]);
  expect(html).toContain('aria-label="Trang 2" aria-current="page"');
});
it("hides pagination when at most four applications remain", () => {
  f.page = 2; f.count = 4;
  const html = render();
  expect(rows(html)).toEqual([4, 3, 2, 1]);
  expect(html).not.toContain('<nav');
});
it("preserves the empty state without pagination", () => {
  f.count = 0;
  const html = render();
  expect(rows(html)).toEqual([]);
  expect(html).not.toContain('<nav');
});

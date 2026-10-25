// @vitest-environment jsdom
import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoundSummary } from "@/components/leaderboard/model";
import { copy } from "@/lib/copy";
import { paginateRounds, parsePage } from "@/components/rounds/pagination";
import { paginationItems, Pagination } from "@/components/common/Pagination";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(useSyncExternalStore(
  listener => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); },
  () => window.location.search,
)) }));
vi.mock("@/lib/context/locale", () => ({ useLocale: () => ({ locale: "vi", t: copy.vi }) }));
vi.mock("@/components/tx/ExplorerLink", () => ({ ExplorerLink: () => null }));
vi.mock("@/components/round/CountdownTimer", () => ({ CountdownTimer: () => null }));
vi.mock("@/components/leaderboard/Primitives", () => ({ AnimatedNumber: ({ value }: { value: number }) => createElement("span", null, value), CopyAddress: () => null, StatusChip: () => null, MetricBar: () => null }));
import { RoundsList } from "@/components/rounds/RoundsList";

const rounds = Array.from({ length: 7 }, (_, i) => ({
  id: `0x${String(i + 1).padStart(40, "0")}`, name: `Round ${i + 1}`, number: i + 1,
  phase: i === 0 ? "closed" : "open", status: "open", matchingPool: 100,
  totalSupporters: 5, projectCount: 2, totalDonated: 10,
  startTime: "2026-10-01T00:00:00Z", endTime: "2026-12-01T00:00:00Z",
})) as RoundSummary[];
let root: Root;
let host: HTMLDivElement;
const scroll = vi.fn();
let reduced = false;
const render = async (data = rounds, props = {}) => act(async () => root.render(createElement(RoundsList, { rounds: data, ...props })));
const click = async (label: string) => {
  const button = Array.from(host.querySelectorAll("button")).find(node => node.getAttribute("aria-label") === label || node.textContent === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", "/round");
  // Mirror Next's native History API subscription without requiring its router.
  const nativePush = window.history.pushState.bind(window.history);
  const nativeReplace = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => { nativePush(...args); window.dispatchEvent(new PopStateEvent("popstate")); });
  vi.spyOn(window.history, "replaceState").mockImplementation((...args) => { nativeReplace(...args); window.dispatchEvent(new PopStateEvent("popstate")); });
  reduced = false;
  window.matchMedia = vi.fn(() => ({ matches: reduced }) as MediaQueryList);
  Element.prototype.scrollIntoView = scroll;
  scroll.mockClear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe("round list pagination", () => {
  it("renders 7 rounds on two pages of 6 and 1, newest first", async () => {
    await render();
    expect(host.querySelectorAll("article")).toHaveLength(6);
    expect(host.querySelector("h2")?.textContent).toBe("Round 7");
    expect(host.textContent).toContain("Hiển thị 1-6 / 7");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Trang trước"]')?.disabled).toBe(true);
    await click("Trang 2");
    expect(window.location.search).toBe("?page=2");
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(host.textContent).toContain("Hiển thị 7-7 / 7");
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("2");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.disabled).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
  it("filters before slicing and resets the page on tab changes", async () => {
    window.history.replaceState(null, "", "/round?page=2"); await render();
    const active = host.querySelectorAll<HTMLButtonElement>('[aria-pressed]')[1];
    await act(async () => active.click());
    expect(window.location.search).toBe("?page=1");
    expect(host.querySelectorAll("article")).toHaveLength(6);
    expect(host.textContent).toContain("Trang 1 / 1");
    expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[aria-pressed]')[2].click());
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(host.querySelector("h2")?.textContent).toBe("Round 1");
  });
  it("clamps a shared URL and later realtime deletions without losing other query keys/hash", async () => {
    window.history.replaceState(null, "", "/round?source=test&page=99#list"); await render();
    expect(window.location.search).toBe("?source=test&page=2");
    expect(window.location.hash).toBe("#list");
    await render(rounds.slice(0, 5));
    expect(window.location.search).toBe("?source=test&page=1");
    expect(host.querySelectorAll("article")).toHaveLength(5);
  });
  it("keeps shared page until loading/discovery finishes and uses six responsive skeletons", async () => {
    window.history.replaceState(null, "", "/round?page=2");
    await render([], { state: "loading", paginationReady: false });
    expect(host.querySelectorAll(".competition-skeleton")).toHaveLength(6);
    expect(window.location.search).toBe("?page=2");
    await render(rounds.slice(0, 2), { paginationReady: false });
    expect(window.location.search).toBe("?page=2");
    await render();
    expect(host.querySelectorAll("article")).toHaveLength(1);
    const grid = host.querySelector("article")!.parentElement!;
    for (const token of ["grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3", "items-stretch", "gap-5"]) expect(grid.classList.contains(token)).toBe(true);
  });
  it("honors history navigation, live inserts and reduced motion", async () => {
    await render(); reduced = true; await click("Trang 2");
    expect(scroll).toHaveBeenLastCalledWith({ behavior: "instant", block: "start" });
    await render([...rounds, { ...rounds[0], id: "new-round", number: 8, name: "Round 8" }]);
    expect(host.querySelectorAll("article")).toHaveLength(2);
    await act(async () => { window.history.replaceState(null, "", "/round?page=1"); });
    expect(host.querySelectorAll("article")).toHaveLength(6);
    expect(host.querySelector("h2")?.textContent).toBe("Round 8");
  });
  it("restores the previous page with browser Back", async () => {
    await render();
    await click("Trang 2");
    await act(async () => {
      const popped = new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }));
      window.history.back();
      await popped;
    });
    expect(window.location.search).toBe("");
    expect(host.querySelectorAll("article")).toHaveLength(6);
  });
  it("handles empty lists and rejects invalid page values", async () => {
    for (const value of [null, "0", "-1", "no", "1.5", "Infinity"]) expect(parsePage(value)).toBe(1);
    expect(paginateRounds([], "all", 99)).toMatchObject({ page: 1, totalPages: 1, total: 0 });
    await render([]); expect(host.textContent).toContain("Hiển thị 0-0 / 0");
  });
  it("bounds long pagination and uses native keyboard accessible buttons", async () => {
    expect(paginationItems(10, 50)).toEqual([1, "gap-1", 9, 10, 11, "gap-11", 50]);
    expect(paginationItems(1, 50).filter(v => typeof v === "number")).toEqual([1, 2, 50]);
    await act(async () => root.render(createElement(Pagination, { page: 10, total: 300, pageSize: 6, onPageChange: vi.fn(), controls: "results" })));
    expect(host.querySelectorAll("button").length).toBeLessThanOrEqual(9);
    expect(host.querySelectorAll('button[aria-controls="results"]').length).toBe(7);
    expect(host.querySelector('nav[aria-label="Phân trang"]')).toBeTruthy();
  });
});

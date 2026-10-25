// @vitest-environment jsdom
import { act, createElement, type ReactElement, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { readFileSync } from "node:fs";
import type { NotificationEntry } from "@/hooks/useNotifications";

const frames = vi.hoisted(() => [] as CSSProperties[]);
const f = vi.hoisted(() => ({ locale: "vi" as "vi" | "en", entries: [] as NotificationEntry[], markAsRead: vi.fn(), markAllAsRead: vi.fn() }));
vi.mock("react-dom", async importOriginal => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (...args: Parameters<typeof actual.createPortal>) => {
    frames.push((args[0] as ReactElement<{ style: CSSProperties }>).props.style);
    return actual.createPortal(...args);
  } };
});
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isConnected: true }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({
  entries: f.entries, unreadEntries: f.entries, unreadCount: f.entries.length, totalCount: f.entries.length,
  markAsRead: f.markAsRead, markAllAsRead: f.markAllAsRead,
}) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy[f.locale], locale: f.locale }) };
});

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  frames.length = 0;
  f.locale = "vi";
  f.entries = [];
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(NotificationBell)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("anchors the very first portal frame to the bell and remeasures on reopening", async () => {
  const trigger = host.querySelector("button")!;
  const rect = vi.spyOn(trigger, "getBoundingClientRect");
  rect.mockReturnValue({ bottom: 74, right: window.innerWidth - 150 } as DOMRect);
  await act(async () => trigger.click());
  expect(frames[0]).toMatchObject({ "--bell-top": "82px", "--bell-right": "150px" });

  await act(async () => trigger.click());
  frames.length = 0;
  rect.mockReturnValue({ bottom: 50, right: window.innerWidth - 4 } as DOMRect);
  await act(async () => trigger.click());
  expect(frames[0]).toMatchObject({ "--bell-top": "58px", "--bell-right": "8px" });

  rect.mockReturnValue({ bottom: 60, right: window.innerWidth - 30 } as DOMRect);
  await act(async () => window.dispatchEvent(new Event("resize")));
  expect(frames.at(-1)).toMatchObject({ "--bell-top": "68px", "--bell-right": "30px" });
});

it.each(["vi", "en"] as const)("keeps the %s header and footer on one line and long entries inside a scrolling list", async locale => {
  f.locale = locale;
  f.entries = Array.from({ length: 40 }, (_, i) => ({ key: `${i}`, scope: "activity", type: "project_approved", isRead: false,
    title: "A long notification title ".repeat(5), description: "Long description ".repeat(30), href: `/round/test/project/${i}` }));
  await act(async () => root.render(createElement(NotificationBell)));
  await act(async () => host.querySelector("button")!.click());
  const panel = document.querySelector('[role="dialog"]')!;
  expect(panel.className).toContain("w-[360px]");
  expect(panel.className).toContain("max-h-[70vh]");
  expect(panel.querySelector("h3")!.className).toContain("whitespace-nowrap");
  const markAll = panel.querySelector<HTMLButtonElement>('button[title]')!;
  expect(markAll.className).toContain("whitespace-nowrap");
  expect(markAll.textContent).toBe(locale === "vi" ? "Đánh dấu đã đọc" : "Mark as read");
  await act(async () => markAll.click());
  expect(f.markAllAsRead).toHaveBeenCalledOnce();
  const list = panel.querySelector('[class*="overflow-y-auto"]')!;
  expect(list.className).toContain("min-h-0");
  expect(list.querySelectorAll("a")).toHaveLength(40);
  expect(list.querySelector("p")!.className).toContain("line-clamp-1");
  expect(list.querySelector("p")!.title).toBe(f.entries[0].description);
  expect(list.querySelector("a")!.getAttribute("href")).toBe(f.entries[0].href);
  expect(panel.querySelector('a[href="/my"]')!.className).toContain("whitespace-nowrap");
  expect(panel.className).not.toMatch(/translate-x|slide-in|animate-in/);
});

it("traps Tab lightly, closes with Escape or outside click, and restores focus", async () => {
  vi.useFakeTimers();
  try {
    const trigger = host.querySelector("button")!;
    await act(async () => trigger.click());
    const first = document.querySelector<HTMLButtonElement>('[role="dialog"] button')!;
    const last = document.querySelector<HTMLAnchorElement>('[role="dialog"] a[href="/my"]')!;
    expect(document.activeElement).toBe(first);
    await act(async () => first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(last);
    await act(async () => last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('[role="dialog"]')!.getAttribute("data-state")).toBe("closed");
    await act(async () => vi.advanceTimersByTime(100));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => trigger.click());
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  } finally { vi.useRealTimers(); }
});

it("centers the mobile panel within 8px margins and uses only vertical motion with reduced-motion support", async () => {
  vi.stubGlobal("innerWidth", 375);
  const trigger = host.querySelector("button")!;
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ bottom: 64, right: 340 } as DOMRect);
  await act(async () => trigger.click());
  expect(frames[0]).toMatchObject({ "--bell-top": "72px", "--bell-right": "8px" });
  const css = readFileSync("src/components/layout/NotificationBell.module.css", "utf8");
  expect(css).toContain("width: calc(100vw - 16px)");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain("translateY(-4px) scale(0.96)");
  expect(css).not.toMatch(/translateX|transition:\s*(all|left|right)/);
});

// @vitest-environment jsdom
import { act, createElement, type ReactElement, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/layout/NotificationBell";

const frames = vi.hoisted(() => [] as CSSProperties[]);
vi.mock("react-dom", async importOriginal => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (...args: Parameters<typeof actual.createPortal>) => {
    frames.push((args[0] as ReactElement<{ style: CSSProperties }>).props.style);
    return actual.createPortal(...args);
  } };
});
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isConnected: false }) }));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => ({
  entries: [], unreadEntries: [], unreadCount: 0, totalCount: 0,
  markAsRead: vi.fn(), markAllAsRead: vi.fn(),
}) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi }) };
});

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  frames.length = 0;
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
  expect(frames[0]).toMatchObject({ "--bell-top": "58px", "--bell-right": "12px" });

  rect.mockReturnValue({ bottom: 60, right: window.innerWidth - 30 } as DOMRect);
  await act(async () => window.dispatchEvent(new Event("resize")));
  expect(frames.at(-1)).toMatchObject({ "--bell-top": "68px", "--bell-right": "30px" });
});

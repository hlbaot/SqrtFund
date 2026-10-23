import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NotificationEntry } from "@/hooks/useNotifications";
import { NotificationBell } from "@/components/layout/NotificationBell";

const f = vi.hoisted(() => ({
  unreadCount: 0,
  totalCount: 0,
  entries: [] as NotificationEntry[],
  unreadEntries: [] as NotificationEntry[],
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    isConnected: true,
    isReady: true,
    entries: f.entries,
    unreadEntries: f.unreadEntries,
    unreadCount: f.unreadCount,
    totalCount: f.totalCount,
    markAsRead: f.markAsRead,
    markAllAsRead: f.markAllAsRead,
  }),
}));

vi.mock("@/hooks/useRole", () => ({
  useRole: () => ({
    isConnected: true,
    isAdmin: false,
    isPlatformOwner: false,
    isOrganizer: false,
  }),
}));

vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.unreadCount = 0;
    f.totalCount = 0;
    f.entries = [];
    f.unreadEntries = [];
  });

  it("renders bell trigger button without badge when unreadCount is 0", () => {
    const html = renderToStaticMarkup(createElement(NotificationBell));
    expect(html).toContain("<button");
    expect(html).toContain('aria-label="Thông báo"');
    expect(html).not.toContain("animate-ping");
  });

  it("renders badge and ping animation when unreadCount > 0", () => {
    f.unreadCount = 3;
    f.totalCount = 5;
    const html = renderToStaticMarkup(createElement(NotificationBell));
    expect(html).toContain("3");
    expect(html).toContain("animate-ping");
    expect(html).toContain('aria-label="3 Thông báo"');
  });

  it("caps badge display at 9+ when unreadCount > 9", () => {
    f.unreadCount = 12;
    f.totalCount = 15;
    const html = renderToStaticMarkup(createElement(NotificationBell));
    expect(html).toContain("9+");
  });
});

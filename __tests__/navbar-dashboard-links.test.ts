import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

const f = vi.hoisted(() => ({ platformOwner: false, role: "organizer", connected: true, admin: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ role: f.role, isReady: true, isConnected: f.connected, isAdmin: f.admin, isPlatformOwner: f.platformOwner }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({}) }));
vi.mock("@/hooks/useNotificationCounts", () => ({ useNotificationCounts: () => ({ admin: 0, activity: 0 }) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.vi, locale: "vi" }) }; });
vi.mock("@/components/layout/ConnectWalletButton", () => ({ ConnectWalletButton: () => null }));
vi.mock("@/components/layout/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/layout/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/common/NetworkGuard", () => ({ NetworkGuard: () => null }));

beforeEach(() => Object.assign(f, { platformOwner: false, role: "organizer", connected: true, admin: true }));

it("keeps Organizer round creation in the wallet menu instead of duplicating it in the Navbar", () => {
  f.platformOwner = false;
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).not.toContain("Tạo round");
  expect(html).not.toContain('href="/admin?tab=organizer"');
  expect(html).not.toContain("Quản trị");
  expect(html).not.toContain('href="/admin?tab=platform"');
});
it("names the platform owner's entry Organizer Access and links to role approval", () => {
  f.platformOwner = true;
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).toContain("Cấp quyền Organizer");
  expect(html).toContain('href="/admin?tab=platform"');
  expect(html).not.toContain('href="/admin?tab=organizer"');
  expect(html).not.toContain('href="/register"');
  expect(html).not.toContain('href="/my"');
});

it.each(["student", "guest"])("preserves project registration and personal activity for %s", role => {
  f.role = role;
  f.admin = false;
  f.connected = role !== "guest";
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).toContain('href="/register"');
  expect(html).toContain('href="/my"');
  expect(html).not.toContain('href="/admin?tab=platform"');
});

it.each(["organizer", "admin"])("hides project registration on navbar for %s but preserves personal activity", role => {
  f.role = role;
  f.admin = true;
  f.connected = true;
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).not.toContain('href="/register"');
  expect(html).toContain('href="/my"');
  expect(html).not.toContain('href="/admin?tab=platform"');
});

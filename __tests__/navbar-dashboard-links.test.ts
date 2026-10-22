import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

const f = vi.hoisted(() => ({ platformOwner: false }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ role: "organizer", isReady: true, isConnected: true, isAdmin: true, isPlatformOwner: f.platformOwner }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({}) }));
vi.mock("@/hooks/useNotificationCounts", () => ({ useNotificationCounts: () => ({ admin: 0, activity: 0 }) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.vi, locale: "vi" }) }; });
vi.mock("@/components/layout/ConnectWalletButton", () => ({ ConnectWalletButton: () => null }));
vi.mock("@/components/layout/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/common/NetworkGuard", () => ({ NetworkGuard: () => null }));

it("names the Organizer entry Create Round and links to the Organizer tab", () => {
  f.platformOwner = false;
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).toContain("Tạo round");
  expect(html).toContain('href="/admin?tab=organizer"');
  expect(html).not.toContain("Quản trị");
  expect(html).not.toContain('href="/admin?tab=platform"');
});
it("names the platform owner's entry Organizer Access and links to role approval", () => {
  f.platformOwner = true;
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).toContain("Cấp quyền Organizer");
  expect(html).toContain('href="/admin?tab=platform"');
  expect(html).not.toContain('href="/admin?tab=organizer"');
});

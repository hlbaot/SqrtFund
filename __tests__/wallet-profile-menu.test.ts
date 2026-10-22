import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConnectWalletButton } from "@/components/layout/ConnectWalletButton";

const f = vi.hoisted(() => ({
  profile: null as "student" | "organizer" | null,
  authorized: false,
  student: false,
  booleanStates: 0,
}));
// Open the real dropdown in server-rendered tests without invoking wallet or DOM effects.
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(
    initial === false && ++f.booleanStates === 2 ? true : initial,
  ) };
});
vi.mock("react-dom", () => ({ createPortal: (children: ReactNode) => children }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890", isConnected: true, chainId: 43113 }),
  useConnect: () => ({ connectors: [] }), useDisconnect: () => ({}), useBalance: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({
  role: f.authorized ? "organizer" : "guest", isReady: true, isStudent: f.student,
  isOrganizer: f.authorized, canCreateRound: f.authorized,
  studentStatus: f.student ? "confirmed" : "absent", organizerStatus: f.authorized ? "confirmed" : "absent",
}) }));
vi.mock("@/hooks/useWalletProfile", () => ({
  defaultWalletProfile: () => null,
  useWalletProfile: () => ({ profile: f.profile, selectProfile: vi.fn() }),
}));
vi.mock("@/lib/walletSession", () => ({}));
vi.mock("@/hooks/useAvatar", () => ({ useAvatar: () => ({ avatar: "auto" }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({}) }));
vi.mock("@/hooks/useNotificationCounts", () => ({ useNotificationCounts: () => ({ admin: 0, activity: 0 }) }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useMyOrganizerApplication: () => ({}) }));
vi.mock("@/components/organizer/ApplyOrganizerModal", () => ({ ApplyOrganizerModal: () => null }));
vi.mock("@/components/ui/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/components/tx/ExplorerLink", () => ({ ExplorerLink: () => null }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
beforeEach(() => {
  f.profile = null; f.authorized = false; f.student = false; f.booleanStates = 0;
  vi.stubGlobal("document", { body: {} });
});
afterEach(() => vi.unstubAllGlobals());
const render = () => renderToStaticMarkup(createElement(ConnectWalletButton));

it("lets an unassigned wallet choose Student or Organizer before displaying profile actions", () => {
  const html = render();
  expect(html).toContain("Chọn loại tài khoản");
  expect(html).toContain("Sinh viên");
  expect(html).toContain("Nhà tổ chức");
  expect(html).not.toContain('href="/verify"');
  expect(html).not.toContain('href="/admin?tab=organizer"');
});
it("keeps the existing Student verification and removes Organizer actions", () => {
  f.profile = "student";
  const html = render();
  expect(html).toContain('href="/verify"');
  expect(html).not.toContain("Đăng ký làm Organizer");
  expect(html).not.toContain("Nhà tổ chức");
  expect(html).not.toContain("Đổi loại tài khoản");
  expect(html).not.toContain("Change account type");
  expect(html).not.toContain("Chọn loại tài khoản");
});
it("lets Organizers apply without an edu verification prompt", () => {
  f.profile = "organizer";
  const html = render();
  expect(html).toContain("Đăng ký làm Organizer");
  expect(html).not.toContain('href="/verify"');
  expect(html).not.toContain("Sinh viên");
  expect(html).not.toContain(".edu");
  expect(html).not.toContain('href="/admin?tab=organizer"');
});
it("shows Create Round for an authorized Organizer without Student verification", () => {
  f.profile = "organizer"; f.authorized = true;
  const html = render();
  expect(html).toContain('href="/admin?tab=organizer"');
  expect(html).toContain("Tạo round");
  expect(html).not.toContain('href="/verify"');
  expect(html).not.toContain("Đăng ký làm Organizer");
});
it("shows only the chosen profile even when a wallet holds both roles", () => {
  f.profile = "student"; f.student = true; f.authorized = true;
  const html = render();
  expect(html).toContain("Đã xác minh");
  expect(html).not.toContain("Đã được cấp quyền");
  expect(html).not.toContain('href="/admin?tab=organizer"');
  expect(html).not.toContain('href="/verify"');
});

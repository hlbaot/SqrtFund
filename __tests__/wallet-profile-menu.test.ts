import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConnectWalletButton } from "@/components/layout/ConnectWalletButton";

const f = vi.hoisted(() => ({
  profile: null as "student" | "organizer" | null,
  ready: true, roundAdmin: false, managed: false, changing: false,
  authorized: false,
  student: false,
  revoked: false,
  pending: false,
  platformOwner: false,
  booleanStates: 0,
}));
// Open the real dropdown in server-rendered tests without invoking wallet or DOM effects.
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(
    initial === false && (++f.booleanStates === 2 || (f.booleanStates === 5 && f.changing)) ? true : initial,
  ) };
});
vi.mock("react-dom", () => ({ createPortal: (children: ReactNode) => children }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890", isConnected: true, chainId: 43113 }),
  useConnect: () => ({ connectors: [] }), useDisconnect: () => ({}), useBalance: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({
  role: f.authorized ? "organizer" : "guest", isReady: f.ready, isStudent: f.student, isRoundAdmin: f.roundAdmin, hasManagedRounds: f.managed,
  isOrganizer: f.authorized, canCreateRound: f.authorized,
  isPlatformOwner: f.platformOwner,
  studentStatus: f.student ? "confirmed" : "absent", organizerStatus: f.authorized ? "confirmed" : "absent",
}) }));
vi.mock("@/hooks/useWalletProfile", () => ({
  defaultWalletProfile: (organizer: boolean, student: boolean) => organizer ? "organizer" : student ? "student" : null,
  useWalletProfile: () => ({ profile: f.profile, switchProfile: vi.fn() }),
}));
vi.mock("@/lib/walletSession", () => ({}));
vi.mock("@/hooks/useAvatar", () => ({ useAvatar: () => ({ avatar: "auto" }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({}) }));
vi.mock("@/hooks/useNotificationCounts", () => ({ useNotificationCounts: () => ({ admin: 0, activity: 0 }) }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useMyOrganizerApplication: () => ({
  isRevoked: f.revoked, isPending: f.pending,
  application: { revocationReason: "Private revocation reason" },
}) }));
vi.mock("@/components/organizer/ApplyOrganizerModal", () => ({ ApplyOrganizerModal: () => null }));
vi.mock("@/components/ui/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/components/tx/ExplorerLink", () => ({ ExplorerLink: () => null }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
beforeEach(() => {
  f.ready = true; f.roundAdmin = false; f.managed = false; f.changing = false;
  f.profile = null; f.authorized = false; f.student = false; f.revoked = false; f.pending = false; f.platformOwner = false; f.booleanStates = 0;
  vi.stubGlobal("document", { body: {} });
});
afterEach(() => vi.unstubAllGlobals());
const render = () => renderToStaticMarkup(createElement(ConnectWalletButton));

it("keeps round creation and platform access available to the platform owner", () => {
  f.platformOwner = true;
  const html = render();
  expect(html).toContain('href="/admin?tab=organizer"');
  expect(html).toContain('href="/admin?tab=platform"');
  expect(html).toContain("Tạo round");
  expect(html).toContain('href="/my"');
  expect(html).not.toContain('href="/register"');
  expect(html).not.toContain("Chuyển đổi vai trò");
});

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

it("shows a single revocation banner and role switch without exposing the reason", () => {
  f.profile = "organizer"; f.revoked = true;
  const html = render();
  expect(html.match(/Quyền Organizer đã bị thu hồi/g)).toHaveLength(1);
  expect(html.match(/Xem chi tiết &amp; Gửi yêu cầu lại/g)).toHaveLength(1);
  expect(html.match(/Chuyển đổi vai trò/g)).toHaveLength(1);
  expect(html).not.toContain("Private revocation reason");
  expect(html).not.toContain("Chi tiết thu hồi &amp; Nộp lại");
  expect(html).not.toContain("Đã bị thu hồi quyền");
  expect(html).not.toContain("Đã thu hồi");
  expect(html).not.toContain("Đổi vai trò");
  expect(html).not.toContain("Đăng ký làm Organizer");
  expect(html.indexOf("0x1234...7890", html.indexOf('role="dialog"')))
    .toBeLessThan(html.indexOf("Quyền Organizer đã bị thu hồi"));
  expect(html.indexOf("Quyền Organizer đã bị thu hồi"))
    .toBeLessThan(html.indexOf("Chuyển đổi vai trò"));
});
it("preserves the pending application action without displaying a revocation warning", () => {
  f.profile = "organizer"; f.pending = true;
  const html = render();
  expect(html).toContain("Đang chờ duyệt");
  expect(html).toContain("Đăng ký làm Organizer");
  expect(html).not.toContain("Quyền Organizer đã bị thu hồi");
  expect(html).not.toContain("Xem chi tiết &amp; Gửi yêu cầu lại");
});
it("does not display Organizer revocation details for the Student profile", () => {
  f.profile = "student"; f.revoked = true;
  const html = render();
  expect(html).toContain("Sinh viên");
  expect(html).not.toContain("Quyền Organizer đã bị thu hồi");
  expect(html).not.toContain("Xem chi tiết &amp; Gửi yêu cầu lại");
});

it.each(["student", "organizer", "round-admin", "managed-round", "platform"])("hides role switching once %s is confirmed, even if the selector was already open", role => {
  f.profile = "student"; f.changing = true;
  f.student = role === "student";
  f.authorized = role === "organizer";
  f.roundAdmin = role === "round-admin";
  f.managed = role === "managed-round";
  f.platformOwner = role === "platform";
  const html = render();
  expect(html).not.toContain("Chuyển đổi vai trò");
  expect(html).not.toContain("Bạn sử dụng ví với vai trò nào?");
});
it("lets an unverified wallet correct its choice before role confirmation", () => {
  f.profile = "student";
  expect(render()).toContain("Chuyển đổi vai trò");
});
it("does not expose role switching while role reads are loading or unavailable", () => {
  f.profile = "organizer"; f.ready = false; f.changing = true;
  const html = render();
  expect(html).not.toContain("Chuyển đổi vai trò");
  expect(html).not.toContain("Bạn sử dụng ví với vai trò nào?");
});

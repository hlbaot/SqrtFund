import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { StudentVerifyBox } from "@/components/verify/StudentVerifyBox";
import { StudentAccessGate } from "@/components/verify/StudentAccessGate";

const f = vi.hoisted(() => ({
  organizer: false, platform: false, student: false, loading: false, connected: true,
  profile: null as "student" | "organizer" | null, domainConfigured: true,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890", chainId: 43113, isConnected: f.connected }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
  usePublicClient: () => ({}), useSwitchChain: () => ({}), useWriteContract: () => ({}),
}));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isOrganizer: f.organizer, isPlatformOwner: f.platform, isStudent: f.student, isAuthorizationLoading: f.loading }) }));
vi.mock("@/hooks/useWalletProfile", () => ({ defaultWalletProfile: () => null, useWalletProfile: () => ({ profile: f.profile }) }));
vi.mock("@/hooks/useStudentStatus", () => ({ useStudentStatus: () => ({ isStudent: f.student, isConfigured: true }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}), useQuery: () => ({ data: { mode: f.domainConfigured ? "allowlist" : "unconfigured", allowedDomains: f.domainConfigured ? ["school.edu.vn"] : [], blockedDomains: [] } }) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
beforeEach(() => {
  f.organizer = false; f.platform = false; f.student = false;
  f.loading = false; f.connected = true; f.profile = null; f.domainConfigured = true;
});
const box = () => renderToStaticMarkup(createElement(StudentVerifyBox));
const gate = () => renderToStaticMarkup(createElement(StudentAccessGate));
it("hides every edu entry point for authorized Organizers, regardless of saved preference", () => {
  f.organizer = true; f.profile = "student";
  expect(box()).toBe("");
  expect(gate()).toBe("");
});
it("does not ask applicants who chose Organizer to verify as students", () => {
  f.profile = "organizer";
  expect(box()).toBe("");
  expect(gate()).toBe("");
});
it("keeps university-email verification for unverified Student wallets", () => {
  f.profile = "student";
  expect(box()).toContain("Xác thực bằng email trường");
  expect(box()).toContain("Gửi mã");
  expect(gate()).toContain('href="/verify"');
});
it("keeps the form available for an unassigned, unverified wallet", () => {
  expect(box()).toContain("student@university.edu.vn");
});
it("hides the form for verified Students, platform administrators and disconnected wallets", () => {
  f.student = true;
  expect(box()).toBe("");
  f.student = false; f.platform = true;
  expect(box()).toBe("");
  f.platform = false; f.connected = false;
  expect(box()).toBe("");
});
it("does not flash a Student form while Organizer authority is being checked", () => {
  f.loading = true;
  expect(box()).toBe("");
});

it("disables OTP submission and explains when no approved university domains are configured", () => {
  f.domainConfigured = false;
  const html = box();
  expect(html).toContain("Chưa cấu hình domain email trường được duyệt");
  expect(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toContain('disabled=""');
});

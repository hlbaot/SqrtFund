import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ expired: false, verified: false, hasChallenge: false, code: "", reset: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/components/ui/Dialog", () => ({ Dialog: ({children}: {children: ReactNode}) => createElement("div", null, children) }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useMyOrganizerApplication: () => ({application:null,isPending:false,refetch:vi.fn()}) }));
vi.mock("@/hooks/useOrganizerEmailOtp", () => ({ useOrganizerEmailOtp: () => ({expired:f.expired,expiresIn:f.expired ? 0 : 60,verified:f.verified,hasChallenge:f.hasChallenge,code:f.code,busy:false,resendIn:0,reset:f.reset,setCode:vi.fn(),requestOtp:vi.fn(),verifyOtp:vi.fn()}) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({locale:"vi",t:copy.vi}) }; });
import { ApplyOrganizerModal } from "@/components/organizer/ApplyOrganizerModal";
const render = () => renderToStaticMarkup(createElement(ApplyOrganizerModal, { isOpen: true, onClose: () => {}, walletAddress:`0x${"1".repeat(40)}` }));
beforeEach(() => { f.expired = false; f.verified = false; f.hasChallenge = false; f.code = ""; });
it("disables sending an application until the email has been verified", () => {
  const html = render();
  expect(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toContain('disabled=""');
  expect(html).toContain("Gửi mã OTP");
});
it("enables application submission only after email verification", () => {
  f.verified = true; const html = render();
  expect(html).toContain("Email đã xác thực");
  const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
  expect(submit).toBeTruthy(); expect(submit).not.toContain('disabled=""');
});
it("shows a six separate digit inputs after requesting a code", () => {
  f.hasChallenge = true;
  const html = render(); expect(html).toContain("one-time-code"); expect(html).toContain("Xác thực mã");
  expect(html.match(/inputMode="numeric"/g)).toHaveLength(6);
  expect(html).toContain("Mã có hiệu lực 1 phút");
});

it("shows a one-minute countdown and locks all six digits after expiration", () => {
  f.hasChallenge = true;
  expect(render()).toContain("Mã hết hạn sau 1:00");
  f.expired = true;
  const html = render();
  expect(html).toContain("Mã đã hết hạn");
  const digits = html.match(/<input[^>]*inputMode="numeric"[^>]*>/g)!;
  expect(digits).toHaveLength(6);
  expect(digits.every(input => input.includes('disabled=""'))).toBe(true);
});

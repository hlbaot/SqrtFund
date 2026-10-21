import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ verified: false, hasChallenge: false, code: "", reset: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/components/ui/Dialog", () => ({ Dialog: ({children}: {children: ReactNode}) => createElement("div", null, children) }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useMyOrganizerApplication: () => ({application:null,isPending:false,refetch:vi.fn()}) }));
vi.mock("@/hooks/useOrganizerEmailOtp", () => ({ useOrganizerEmailOtp: () => ({verified:f.verified,hasChallenge:f.hasChallenge,code:f.code,busy:false,resendIn:0,reset:f.reset,setCode:vi.fn(),requestOtp:vi.fn(),verifyOtp:vi.fn()}) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({locale:"vi",t:copy.vi}) }; });
import { ApplyOrganizerModal } from "@/components/organizer/ApplyOrganizerModal";
const render = () => renderToStaticMarkup(createElement(ApplyOrganizerModal, { isOpen: true, onClose: () => {}, walletAddress:`0x${"1".repeat(40)}` }));
beforeEach(() => { f.verified = false; f.hasChallenge = false; f.code = ""; });
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
it("shows a separate six-digit OTP input after requesting a code", () => {
  f.hasChallenge = true;
  const html = render(); expect(html).toContain("one-time-code"); expect(html).toContain("Xác thực mã");
});

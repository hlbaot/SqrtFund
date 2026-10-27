// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApplyOrganizerModal } from "@/components/organizer/ApplyOrganizerModal";
import { ApiError } from "@/lib/api";
const f = vi.hoisted(() => ({ sign: vi.fn(), post: vi.fn(), reset: vi.fn(), success: vi.fn(), error: vi.fn() }));
const wallet = `0x${"6".repeat(40)}`;
const previous = { id: "previous", walletAddress: wallet, organizationName: "CLB BT", contactEmail: "old@example.test",
  reason: "Organize a student funding round", emailVerifiedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z", status: "revoked" };
vi.mock("wagmi", () => ({ useSignMessage: () => ({ signMessageAsync: f.sign }) }));
vi.mock("@/lib/api", () => ({ api: { post: f.post }, ApiError: class extends Error { constructor(readonly code: string) { super(code); } } }));
vi.mock("@/lib/txToast", () => ({ txToast: { success: f.success, error: f.error, info: vi.fn() } }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/components/ui/Dialog", () => ({ Dialog: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useMyOrganizerApplication: (address?: string) => ({
  application: address === wallet ? previous : null, isRevoked: address === wallet, isPending: false, isLoading: false, refetch: vi.fn(),
}) }));
vi.mock("@/hooks/useOrganizerEmailOtp", () => ({ useOrganizerEmailOtp: () => ({ verified: false, busy: false, reset: f.reset }) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
let host: HTMLDivElement;
let root: Root;
const render = (address = wallet) => act(async () => root.render(createElement(ApplyOrganizerModal, { isOpen: true, onClose: vi.fn(), walletAddress: address })));
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks(); localStorage.clear();
  f.sign.mockResolvedValue(`0x${"a".repeat(130)}`);
  f.post.mockResolvedValue({ data: { ok: true, application: { ...previous, status: "pending" } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await render();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("restores the old application and verified email, then resubmits with a wallet signature instead of another OTP", async () => {
  const reapply = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Gửi yêu cầu lại"))!;
  await act(async () => reapply.click());
  expect([...host.querySelectorAll("input")].map(input => input.value)).toEqual([previous.organizationName, previous.contactEmail]);
  expect(host.querySelector("textarea")!.value).toBe(previous.reason);
  expect(host.querySelector<HTMLInputElement>('input[type="email"]')!.disabled).toBe(true);
  expect(host.textContent).toContain("Email đã xác thực");
  expect(host.textContent).not.toContain("Gửi mã OTP");
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(f.sign).toHaveBeenCalledWith(expect.objectContaining({ account: wallet }));
  expect(f.post).toHaveBeenCalledWith("/api/organizer-applications", expect.objectContaining({
    walletAddress: wallet, organizationName: previous.organizationName, contactEmail: previous.contactEmail,
    reason: previous.reason, applicationId: previous.id, expectedUpdatedAt: previous.updatedAt, signature: expect.any(String),
  }));
});

it("does not expose the previous wallet's cached information after switching wallets", async () => {
  await render(`0x${"7".repeat(40)}`);
  expect([...host.querySelectorAll("input")].map(input => input.value)).toEqual(["", ""]);
  expect(host.querySelector("textarea")!.value).toBe("");
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect(host.textContent).not.toContain(previous.contactEmail);
});

it("keeps a reused verified email free of red identity warnings while reporting a submission failure", async () => {
  f.post.mockRejectedValueOnce(new ApiError("WALLET_ALREADY_VERIFIED"));
  const reapply = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Gửi yêu cầu lại"))!;
  await act(async () => reapply.click());
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const errors = host.querySelectorAll('[role="alert"]');
  expect(errors).toHaveLength(1);
  expect(errors[0].textContent).toContain("Chưa gửi được yêu cầu");
  expect(host.textContent).not.toContain("Ví này đã được liên kết");
  expect(host.textContent).toContain("Email đã xác thực");
  expect(host.querySelector('input[type="email"]')!.getAttribute("aria-invalid")).not.toBe("true");
});

it("preserves the form and reports an unconfirmed save after database failure", async () => {
  f.post.mockRejectedValueOnce(new ApiError("SERVICE_UNAVAILABLE"));
  const reapply=[...host.querySelectorAll("button")].find(button=>button.textContent?.includes("Gửi yêu cầu lại"))!;
  await act(async()=>reapply.click());
  const resets=f.reset.mock.calls.length;
  await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  expect(host.querySelector("form")).not.toBeNull();
  expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(previous.reason);
  expect(host.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe(previous.contactEmail);
  expect(host.textContent).toContain("Chưa nhận được xác nhận lưu đơn");
  expect(f.success).not.toHaveBeenCalled();expect(f.reset).toHaveBeenCalledTimes(resets);
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
});

it.each([undefined, {id:"wrong-wallet",walletAddress:`0x${"9".repeat(40)}`,status:"pending"}, {...previous,status:"approved"}])("does not show success for an incomplete or mismatched save acknowledgment", async application => {
  f.post.mockResolvedValueOnce({data:{ok:true,application}});
  const reapply=[...host.querySelectorAll("button")].find(button=>button.textContent?.includes("Gửi yêu cầu lại"))!;
  await act(async()=>reapply.click());
  await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  expect(f.success).not.toHaveBeenCalled();expect(host.querySelector("form")).not.toBeNull();
  expect(host.textContent).toContain("Chưa nhận được xác nhận lưu đơn");
});

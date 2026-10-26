// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useOrganizerEmailOtp } from "@/hooks/useOrganizerEmailOtp";
const f = vi.hoisted(() => ({ sign: vi.fn(), post: vi.fn() }));
vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: f.sign }),
}));
vi.mock("@/lib/contracts/addresses", () => ({
  factoryAddress: `0x${"1".repeat(40)}`,
}));
vi.mock("@/hooks/useCurrentTimestamp", () => ({
  useCurrentTimestamp: () => Math.floor(Date.now() / 1000),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api: { post: f.post },
}));
let root: Root,
  host: HTMLDivElement,
  state: ReturnType<typeof useOrganizerEmailOtp>;
const wallet = `0x${"2".repeat(40)}`;
function Probe({
  email = "fixture@school.edu.vn",
  address = wallet,
}: {
  email?: string;
  address?: string;
}) {
  const result = useOrganizerEmailOtp(address, email);
  useEffect(() => {
    state = result;
  });
  return null;
}
async function render(email?: string, address?: string) {
  await act(async () => root.render(createElement(Probe, { email, address })));
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  f.sign.mockResolvedValue(`0x${"a".repeat(130)}`);
  f.post.mockImplementation(async (_url, body) => ({
    data:
      body.action === "request"
        ? {
            ok: true,
            requestId: "fixture",
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            resendAfter: 60,
          }
        : {
            ok: true,
            emailVerificationToken: "fixture-token",
            expiresAt: Date.now() + 900_000,
          },
  }));
  host = document.createElement("div");
  root = createRoot(host);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("signs only after user action and reuses the memory proof for OTP confirmation", async () => {
  expect(f.sign).not.toHaveBeenCalled();
  expect(f.post).not.toHaveBeenCalled();
  await act(async () => state.requestOtp());
  expect(f.sign).toHaveBeenCalledOnce();
  expect(f.sign.mock.calls[0][0].message).toContain("Purpose: organizer");
  expect(state.hasChallenge).toBe(true);
  await act(async () => state.setCode("123456"));
  await act(async () => state.verifyOtp());
  expect(state.verified).toBe(true);
  expect(f.sign).toHaveBeenCalledOnce();
  expect(f.post.mock.calls[1][1].walletProof).toEqual(
    f.post.mock.calls[0][1].walletProof,
  );
});
it("does not send mail if the user rejects the wallet signature", async () => {
  f.sign.mockRejectedValueOnce(new Error("User rejected"));
  await act(async () => state.requestOtp());
  expect(f.post).not.toHaveBeenCalled();
  expect(state.hasChallenge).toBe(false);
});
it("clears usable challenge/proof when email identity changes and signs the new identity", async () => {
  await act(async () => state.requestOtp());
  await render("other@school.edu.vn");
  expect(state.hasChallenge).toBe(false);
  expect(state.verified).toBe(false);
  await act(async () => state.requestOtp());
  expect(f.sign).toHaveBeenCalledTimes(2);
  expect(f.post.mock.calls[1][1].walletProof.email).toBe("other@school.edu.vn");
});
it("discards a signature that resolves after switching wallets", async () => {
  let resolve!: (signature: `0x${string}`) => void;
  f.sign.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = state.requestOtp();
  });
  await render(undefined, `0x${"3".repeat(40)}`);
  await act(async () => {
    resolve(`0x${"a".repeat(130)}`);
    await pending;
  });
  expect(f.post).not.toHaveBeenCalled();
  expect(state.hasChallenge).toBe(false);
});
it("reset removes the cached credential so the next attempt asks for a new signature", async () => {
  await act(async () => state.requestOtp());
  await act(async () => state.reset());
  await act(async () => state.requestOtp());
  expect(f.sign).toHaveBeenCalledTimes(2);
});

it("does not revive an email token after switching away and returning to the old email", async () => {
  await act(async () => state.requestOtp());
  await act(async () => state.setCode("123456"));
  await act(async () => state.verifyOtp());
  expect(state.verified).toBe(true);
  await render("other@school.edu.vn");
  await render("fixture@school.edu.vn");
  expect(state.verified).toBe(false);
  expect(state.hasChallenge).toBe(false);
});
it("does not sign or submit a confirmation without a challenge and six digits", async () => {
  await act(async () => state.verifyOtp());
  expect(f.sign).not.toHaveBeenCalled();
  expect(f.post).not.toHaveBeenCalled();
});
it("does not attach an old email's OTP request to a rate-limited new email", async () => {
  await act(async () => state.requestOtp());
  await render("other@school.edu.vn");
  const { ApiError } = await import("@/lib/api");
  f.post.mockRejectedValueOnce(new ApiError("RATE_LIMITED", 60));
  await act(async () => state.requestOtp());
  expect(state.hasChallenge).toBe(false);
  expect(state.resendIn).toBeGreaterThan(0);
});

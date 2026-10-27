import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  EMAIL_WALLET_PROOF_TTL_MS,
  emailWalletMessage,
  type EmailWalletPermit,
} from "@/lib/emailWalletProof";
import { authorizeEmailWallet } from "@/lib/server/emailWalletAuthorization";
import { POST as studentRequest } from "@/app/api/verify/request-otp/route";
import { POST as studentConfirm } from "@/app/api/verify/confirm/route";
import { POST as organizer } from "@/app/api/organizer-applications/email/route";
import { verifyOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
import { hashValue } from "@/lib/verify/otp";
const f = vi.hoisted(() => ({
  claim: vi.fn(),
  rpc: vi.fn(),
  sign: vi.fn(),
  reserve: vi.fn(),
  send: vi.fn(),
  from: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({
  ensureEmailWallet: f.claim,
}));
vi.mock("@/lib/verify/config", () => ({
  verificationConfig: vi.fn(),
  requireConfig: vi.fn(),
  mailConfig: vi.fn(),
}));
vi.mock("@/lib/verify/signer", () => ({
  validateRegistry: async () => `0x${"2".repeat(40)}`,
  signVerification: f.sign,
}));
vi.mock("@/lib/verify/rateLimit", () => ({ reserveOtp: f.reserve }));
vi.mock("@/lib/verify/mailer", () => ({ sendOtp: f.send }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ from: f.from, rpc: f.rpc }),
}));
const account = privateKeyToAccount(`0x${"13".repeat(32)}`);
const attacker = privateKeyToAccount(`0x${"14".repeat(32)}`);
const wallet = account.address.toLowerCase();
const email = "fixture@school.edu.vn";
const factory = `0x${"3".repeat(40)}`;
const identity = `0x${"a".repeat(64)}`;
const requestId = "11111111-1111-4111-8111-111111111111";
const row = {
  email,
  address: wallet,
  email_hash: identity,
  registry_address: `0x${"2".repeat(40)}`,
  email_domain: "school.edu.vn",
};
function req(body: unknown) {
  return new Request("https://sqrt.test/api/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function permit(
  purpose: "student" | "organizer" = "student",
): EmailWalletPermit {
  const issuedAt = Date.now();
  return {
    purpose,
    email,
    wallet,
    deployment: purpose === "student" ? `0x${"2".repeat(40)}` : factory,
    origin: "https://sqrt.test",
    chainId: 43113,
    issuedAt,
    expiresAt: issuedAt + EMAIL_WALLET_PROOF_TTL_MS,
    nonce: "ab".repeat(16),
  };
}
async function signed(p = permit(), signer = account) {
  return {
    ...p,
    signature: await signer.signMessage({ message: emailWalletMessage(p) }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", factory);
  vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", `0x${"2".repeat(40)}`);
  vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", "43113");
  vi.stubEnv("OTP_SECRET", "fixture-secret-at-least-32-characters");
  vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "school.edu.vn");
  vi.stubEnv("BLOCKED_EMAIL_DOMAINS", "");
  f.claim.mockResolvedValue(identity);
  f.rpc.mockResolvedValue({ data: { status: "OK" }, error: null });
  f.sign.mockResolvedValue(`0x${"1".repeat(130)}`);
  f.reserve.mockResolvedValue({ status: "ALREADY_VERIFIED" });
  f.from.mockImplementation(() => {
    let selected = "";
    const q = {
      select: (s: string) => {
        selected = s;
        return q;
      },
      eq: () => q,
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: { address: wallet }, error: null }),
      upsert: () => q,
      update: () => q,
      delete: () => q,
      lt: () => q,
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ data: selected ? row : null, error: null }).then(
          resolve,
        ),
    };
    return q;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("accepts a real EOA signature for the exact canonical email identity", async () => {
  await expect(
    authorizeEmailWallet(
      req({}),
      await signed(),
      " Fixture+club@school.edu.vn ",
      wallet,
      "student",
    ),
  ).resolves.toBeUndefined();
});
it.each([
  "email",
  "wallet",
  "purpose",
  "origin",
  "deployment",
  "chainId",
  "nonce",
  "expiresAt",
])("rejects tampering with %s", async (field) => {
  const proof = await signed();
  const replacements = {
    email: "other@school.edu.vn",
    wallet: attacker.address.toLowerCase(),
    purpose: "organizer",
    origin: "https://evil.test",
    deployment: `0x${"4".repeat(40)}`,
    chainId: 1,
    nonce: "cd".repeat(16),
    expiresAt: proof.expiresAt + 1,
  };
  await expect(
    authorizeEmailWallet(
      req({}),
      { ...proof, [field]: replacements[field as keyof typeof replacements] },
      email,
      wallet,
      "student",
    ),
  ).rejects.toMatchObject({ status: 401 });
});
it("rejects a correctly signed claim targeting someone else's wallet", async () => {
  await expect(
    authorizeEmailWallet(
      req({}),
      await signed(permit(), attacker),
      email,
      wallet,
      "student",
    ),
  ).rejects.toMatchObject({ code: "WALLET_PROOF_INVALID" });
});
it.each(["expired", "future", "long-lived"])(
  "rejects %s proofs even with a real signature",
  async (kind) => {
    const p = permit();
    if (kind === "expired") {
      p.issuedAt -= EMAIL_WALLET_PROOF_TTL_MS + 1;
      p.expiresAt -= EMAIL_WALLET_PROOF_TTL_MS + 1;
    }
    if (kind === "future") {
      p.issuedAt += 60_000;
      p.expiresAt += 60_000;
    }
    if (kind === "long-lived") p.expiresAt += 60_000;
    await expect(
      authorizeEmailWallet(req({}), await signed(p), email, wallet, "student"),
    ).rejects.toMatchObject({ status: 401 });
  },
);
it.each([undefined, {}, { signature: "garbage" }, []])(
  "rejects missing or malformed credentials",
  async (proof) => {
    await expect(
      authorizeEmailWallet(req({}), proof, email, wallet, "student"),
    ).rejects.toMatchObject({ status: 401 });
  },
);
it.each([
  "student-request",
  "student-confirm",
  "organizer-request",
  "organizer-confirm",
])(
  "%s refuses unsigned requests before claim/consume/mail/sign",
  async (path) => {
    const response =
      path === "student-request"
        ? await studentRequest(req({ email, address: wallet }))
        : path === "student-confirm"
          ? await studentConfirm(req({ requestId, otp: "123456" }))
          : await organizer(
              req({
                walletAddress: wallet,
                contactEmail: email,
                action: path === "organizer-request" ? "request" : "verify",
                requestId,
                otp: "123456",
              }),
            );
    expect(response.status).toBe(401);
    expect(f.claim).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.send).not.toHaveBeenCalled();
    expect(f.sign).not.toHaveBeenCalled();
  },
);
it("a forged victim-wallet signature cannot consume a Student OTP or bind the wallet", async () => {
  const response = await studentConfirm(
    req({
      requestId,
      otp: "123456",
      walletProof: await signed(permit(), attacker),
    }),
  );
  expect(response.status).toBe(401);
  expect(f.rpc).not.toHaveBeenCalled();
  expect(f.claim).not.toHaveBeenCalled();
});
it("legitimate Student confirmation consumes OTP, binds and releases attestation", async () => {
  const response = await studentConfirm(
    req({ requestId, otp: "123456", walletProof: await signed() }),
  );
  expect(response.status).toBe(200);
  expect(f.rpc).toHaveBeenCalledWith("consume_otp", expect.anything());
  expect(f.claim).toHaveBeenCalledWith(email, wallet, true, expect.anything());
  expect(f.sign).toHaveBeenCalledOnce();
});
it("Student attestation resume requires and accepts ownership proof", async () => {
  const response = await studentRequest(
    req({ email, address: wallet, walletProof: await signed() }),
  );
  expect(response.status).toBe(200);
  expect(f.sign).toHaveBeenCalledOnce();
});
it("legitimate Organizer proof + OTP creates a new-version email token", async () => {
  const response = await organizer(
    req({
      walletAddress: wallet,
      contactEmail: email,
      action: "verify",
      requestId,
      otp: "123456",
      walletProof: await signed(permit("organizer")),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(
    verifyOrganizerEmailProof(body.emailVerificationToken, email, wallet),
  ).toBe(true);
  expect(f.claim).toHaveBeenCalledWith(email, wallet, true, expect.anything());
});
it("does not accept pre-fix Organizer tokens even if their HMAC is valid", () => {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: "organizer-contact-email",
      email,
      wallet,
      expiresAt: Date.now() + 60_000,
    }),
  ).toString("base64url");
  expect(
    verifyOrganizerEmailProof(
      `${payload}.${hashValue(`organizer-contact-email:${payload}`, "otp")}`,
      email,
      wallet,
    ),
  ).toBe(false);
});

it("Student ownership proof remains valid when no Factory is configured", async () => {
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", "");
  await expect(
    authorizeEmailWallet(req({}), await signed(), email, wallet, "student"),
  ).resolves.toBeUndefined();
});

it("a valid wallet signature does not make an unapproved edu mailbox eligible", async () => {
  const p = { ...permit(), email: "fixture@untrusted-school.edu.vn" };
  const response = await studentRequest(req({ email: p.email, address: wallet, walletProof: await signed(p) }));
  expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: "INVALID_DOMAIN" });
  expect(f.claim).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled();
  expect(f.from).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
});
it("a previously issued OTP and valid wallet proof cannot attest a domain removed from policy", async () => {
  const p = { ...permit(), email: "fixture@untrusted-school.edu.vn" };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { ...row, email: p.email, email_domain: "untrusted-school.edu.vn" }, error: null }) };
  f.from.mockReturnValue(query);
  const response = await studentConfirm(req({ requestId, otp: "123456", walletProof: await signed(p) }));
  expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: "INVALID_DOMAIN" });
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.claim).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
});

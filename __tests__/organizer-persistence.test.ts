import { beforeEach, afterEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  list: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
  publish: vi.fn(),
  connectionError: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/organizerReadAuthorization", () => ({
  authorizeOrganizerRead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/server/organizerReviewAuthorization", () => ({
  authorizeOrganizerReview: async (body: Record<string, unknown>) => ({
    reviewedBy: body.reviewedBy,
    expectedUpdatedAt: body.expectedUpdatedAt,
  }),
}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({
  ensureEmailWallet: vi.fn().mockResolvedValue(`0x${"a".repeat(64)}`),
}));
vi.mock("@/lib/server/publishNotificationChange", () => ({
  publishNotificationChange: f.publish,
}));
vi.mock("@/lib/verify/supabaseAdmin", () => ({
  supabaseAdmin: () => {
    if (f.connectionError) throw new Error("private connection details");
    return {
      rpc: f.rpc,
      from: () => {
        const q = {
          select: () => q,
          order: () => q,
          eq: () => q,
          ilike: () => q,
          insert: () => q,
          update: () => q,
          single: () => f.insert(),
          maybeSingle: () => f.update(),
          then: (
            resolve: (r: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => f.list().then(resolve, reject),
        };
        return q;
      },
    };
  },
}));
import { GET, POST, PATCH } from "@/app/api/organizer-applications/route";
import {
  createOrganizerApplication,
  listOrganizerApplications,
  resubmitOrganizerApplication,
  updateOrganizerApplicationStatus,
} from "@/lib/server/organizerApplications";
import { issueOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
const wallet = `0x${"1".repeat(40)}`,
  reviewer = `0x${"2".repeat(40)}`,
  id = "04040404-0404-4404-8404-040404040404",
  email = "fixture@example.invalid";
const now = "2026-10-27T00:00:00.000Z";
const row = {
  id,
  wallet_address: wallet,
  organization_name: "Fixture Club",
  contact_email: email,
  email_verified_at: now,
  reason: "Fixture funding round",
  status: "pending",
  created_at: now,
  updated_at: now,
};
const input = {
  walletAddress: wallet,
  organizationName: row.organization_name,
  contactEmail: email,
  emailVerifiedAt: now,
  reason: row.reason,
};
function request(body: unknown, method = "POST") {
  return new Request("https://sqrt.test/api/organizer-applications", {
    method,
    body: JSON.stringify(body),
  });
}
function submit() {
  return POST(
    request({
      ...input,
      emailVerificationToken: issueOrganizerEmailProof(email, wallet)
        .emailVerificationToken,
    }),
  );
}
function review() {
  return PATCH(
    request(
      { id, status: "approved", reviewedBy: reviewer, expectedUpdatedAt: now },
      "PATCH",
    ),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OTP_SECRET", "fixture-secret-long-enough-for-persistence-tests");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  f.connectionError = false;
  f.list.mockResolvedValue({ data: [], error: null });
  f.insert.mockResolvedValue({ data: row, error: null });
  f.update.mockResolvedValue({ data: row, error: null });
  f.rpc.mockResolvedValue({
    data: { status: "OK", application: { ...row, status: "approved" } },
    error: null,
  });
  f.publish.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it.each(["42P01", "23514", "08006"])(
  "POST does not invent success after insert error %s",
  async (code) => {
    f.insert.mockResolvedValue({
      data: null,
      error: { code, message: "private fixture details" },
    });
    const r = await submit();
    expect(r.status).toBe(503);
    const b = await r.json();
    expect(b.ok).toBe(false);
    expect(b).not.toHaveProperty("application");
    expect(f.publish).not.toHaveBeenCalled();
    expect(JSON.stringify(b)).not.toContain("private fixture");
  },
);
it("does not report an empty application list when reading the database fails", async () => {
  f.list.mockResolvedValue({ data: null, error: { code: "08006" } });
  const r = await GET(
    new Request("https://sqrt.test/api/organizer-applications"),
  );
  expect(r.status).toBe(503);
  expect(await r.json()).not.toHaveProperty("applications");
});
it("does not turn update failure into a missing/stale application conflict", async () => {
  f.rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  f.update.mockResolvedValue({ data: null, error: { code: "08006" } });
  const r = await review();
  expect(r.status).toBe(503);
  expect(f.publish).not.toHaveBeenCalled();
});
it("returns a persisted application and publishes only after confirmed insert", async () => {
  const response = await submit();
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.application.id).toBe(id);
  expect(body.application.createdAt).toBe(now);
  expect(f.publish).toHaveBeenCalledOnce();
  expect(f.insert.mock.invocationCallOrder[0]).toBeLessThan(
    f.publish.mock.invocationCallOrder[0],
  );
});
it.each([
  null,
  {},
  { ...row, status: "unknown" },
  { ...row, updated_at: null },
])(
  "does not invent missing fields from an invalid insert response",
  async (data) => {
    f.insert.mockResolvedValue({ data, error: null });
    const r = await submit();
    expect(r.status).toBe(503);
    expect(await r.json()).not.toHaveProperty("application");
    expect(f.publish).not.toHaveBeenCalled();
  },
);
it("does not expose a phantom memory application after a failed insert", async () => {
  f.insert.mockResolvedValueOnce({ data: null, error: { code: "08006" } });
  expect((await submit()).status).toBe(503);
  const r = await GET(
    new Request("https://sqrt.test/api/organizer-applications"),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true, applications: [] });
  expect(f.publish).not.toHaveBeenCalled();
});
it.each([null, {}])(
  "does not translate malformed successful reads into an empty list",
  async (data) => {
    f.list.mockResolvedValue({ data, error: null });
    const r = await GET(
      new Request("https://sqrt.test/api/organizer-applications"),
    );
    expect(r.status).toBe(503);
    expect(await r.json()).not.toHaveProperty("applications");
  },
);
it("returns 503 when the pre-submit read fails and never tries to create a substitute", async () => {
  f.list.mockRejectedValueOnce(new Error("private connection details"));
  const r = await submit();
  expect(r.status).toBe(503);
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.publish).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "private connection details",
  );
});
it.each(["create", "list", "resubmit", "review"])(
  "%s propagates connection failure instead of using process memory",
  async (action) => {
    f.connectionError = true;
    const previous = {
      ...input,
      id,
      status: "rejected" as const,
      createdAt: now,
      updatedAt: now,
    };
    const work =
      action === "create"
        ? () => createOrganizerApplication(input)
        : action === "list"
          ? () => listOrganizerApplications()
          : action === "resubmit"
            ? () => resubmitOrganizerApplication(previous, input)
            : () =>
                updateOrganizerApplicationStatus(id, {
                  status: "approved",
                  reviewedBy: reviewer,
                  expectedUpdatedAt: now,
                });
    await expect(work()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
    expect(f.publish).not.toHaveBeenCalled();
  },
);
it.each(["PGRST202", "08006"])(
  "review schema/connection error %s cannot publish success",
  async (code) => {
    f.rpc.mockResolvedValue({ data: null, error: { code } });
    const r = await review();
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({
      ok: false,
      error: code === "PGRST202" ? "DB_SCHEMA_MISMATCH" : "SERVICE_UNAVAILABLE",
    });
    expect(f.publish).not.toHaveBeenCalled();
  },
);
it.each([null, { status: "OK" }, { status: "UNKNOWN" }])(
  "review rejects an incomplete RPC acknowledgment",
  async (data) => {
    f.rpc.mockResolvedValue({ data, error: null });
    const r = await review();
    expect(r.status).toBe(503);
    expect(f.publish).not.toHaveBeenCalled();
  },
);
it("a stale signed review returns 409 without a notification", async () => {
  f.rpc.mockResolvedValue({ data: { status: "CHANGED" }, error: null });
  const r = await review();
  expect(r.status).toBe(409);
  expect(f.publish).not.toHaveBeenCalled();
});
it("a confirmed review returns the persisted version and publishes once", async () => {
  const r = await review();
  expect(r.status).toBe(200);
  expect((await r.json()).application.status).toBe("approved");
  expect(f.publish).toHaveBeenCalledOnce();
});
it("resubmit propagates a database schema failure", async () => {
  f.update.mockResolvedValue({ data: null, error: { code: "42P01" } });
  await expect(
    resubmitOrganizerApplication(
      { ...input, id, status: "revoked", createdAt: now, updatedAt: now },
      input,
    ),
  ).rejects.toMatchObject({ code: "DB_SCHEMA_MISMATCH", status: 503 });
});

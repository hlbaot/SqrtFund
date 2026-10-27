import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// An isolated test database adapter. Production code has no in-memory storage.
const dbFixture = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), revision: 0 }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({
  from: () => {
    let inserted: Record<string, unknown> | undefined;
    const filters: [string, unknown][] = [];
    const query = {
      insert: (row: Record<string, unknown>) => { inserted = row; return query; },
      select: () => query, order: () => query,
      ilike: (key: string, value: string) => { filters.push([key,value.toLowerCase()]);return query; },
      eq: (key: string, value: unknown) => { filters.push([key,value]);return query; },
      single: async () => {
        if (!inserted) return {data:null,error:{code:"FIXTURE_ERROR"}};
        dbFixture.rows.set(String(inserted.id),inserted);return {data:inserted,error:null};
      },
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({data:[...dbFixture.rows.values()]
        .filter(row => filters.every(([key,value]) => typeof row[key] === "string" && typeof value === "string" ? String(row[key]).toLowerCase() === value.toLowerCase() : row[key] === value)),error:null}).then(resolve),
    };return query;
  },
  rpc: async (_name: string, params: Record<string, unknown>) => {
    const previous=dbFixture.rows.get(String(params.p_id));
    if(!previous || previous.updated_at !== params.p_expected_updated_at || (params.p_status === "revoked" && previous.status !== "approved"))return {data:{status:"CHANGED"},error:null};
    const patch={status:params.p_status,tx_hash:params.p_tx_hash,revocation_reason:params.p_revocation_reason,reviewed_by:params.p_reviewed_by,updated_at:new Date(Date.now()+(++dbFixture.revision)).toISOString()};
    const next={...previous,...patch};dbFixture.rows.set(String(params.p_id),next);
    return {data:{status:"OK",application:next},error:null};
  },
}) }));


vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/publishNotificationChange", () => ({ publishNotificationChange: vi.fn().mockResolvedValue(undefined) }));
import { publishNotificationChange } from "@/lib/server/publishNotificationChange";
vi.mock("@/lib/server/organizerReviewAuthorization", () => ({ authorizeOrganizerReview: vi.fn(async (body: Record<string, unknown>) => ({ reviewedBy: body.reviewedBy, expectedUpdatedAt: body.expectedUpdatedAt })) }));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn().mockResolvedValue(undefined) }));

import { authorizeOrganizerReview } from "@/lib/server/organizerReviewAuthorization";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { VerificationError } from "@/lib/verify/errors";
import { issueOrganizerEmailProof } from "@/lib/server/organizerEmailProof";

beforeEach(() => { dbFixture.rows.clear(); dbFixture.revision = 0; vi.stubEnv("OTP_SECRET", "o".repeat(32)); vi.mocked(publishNotificationChange).mockClear(); });
afterEach(() => vi.unstubAllEnvs());

import { GET, POST, PATCH } from "@/app/api/organizer-applications/route";

describe("Organizer Applications API", () => {
  const sampleWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const validPayload = {
    walletAddress: sampleWallet,
    organizationName: "GDSC HCMUT",
    contactEmail: "gdsc@hcmut.edu.vn",
    reason: "We plan to organize an open source funding round for students in Spring 2026.",
  };

  it("rejects invalid request body in POST", async () => {
    const req = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_BODY");
    expect(publishNotificationChange).not.toHaveBeenCalled();
  });

  it("rejects invalid wallet address in POST", async () => {
    const req = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, walletAddress: "invalid-0x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_WALLET_ADDRESS");
  });

  it("rejects too short organization name in POST", async () => {
    const req = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, organizationName: "A" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_ORGANIZATION_NAME");
  });

  it("rejects invalid email format in POST", async () => {
    const req = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, contactEmail: "notanemail" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_EMAIL");
  });

  it("rejects too short reason in POST", async () => {
    const req = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, reason: "Hi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_REASON");
  });

  it("creates a pending organizer application successfully", async () => {
    const testWallet = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const req = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validPayload,
        walletAddress: testWallet, emailVerificationToken: issueOrganizerEmailProof(validPayload.contactEmail, testWallet).emailVerificationToken,
        organizationName: "Blockchain Innovation Lab",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.application.walletAddress.toLowerCase()).toBe(testWallet.toLowerCase());
    expect(json.application.organizationName).toBe("Blockchain Innovation Lab");
    expect(json.application.status).toBe("pending");
    expect(json.application.id).toBeTruthy();
  });

  it("prevents submitting duplicate pending application for the same wallet", async () => {
    const testWallet = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
    const postReq1 = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, walletAddress: testWallet, emailVerificationToken: issueOrganizerEmailProof(validPayload.contactEmail, testWallet).emailVerificationToken }),
    });
    const res1 = await POST(postReq1);
    expect(res1.status).toBe(201);

    // Try posting again with same wallet
    const postReq2 = new Request("http://localhost/api/organizer-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, walletAddress: testWallet, emailVerificationToken: issueOrganizerEmailProof(validPayload.contactEmail, testWallet).emailVerificationToken }),
    });
    const res2 = await POST(postReq2);
    expect(res2.status).toBe(409);
    const json2 = await res2.json();
    expect(json2.error).toBe("APPLICATION_ALREADY_PENDING");
  });

  it("does not expose an application to an anonymous caller who knows its wallet", async () => {
    const testWallet = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
    await POST(
      new Request("http://localhost/api/organizer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, walletAddress: testWallet, emailVerificationToken: issueOrganizerEmailProof(validPayload.contactEmail, testWallet).emailVerificationToken, organizationName: "AI Club" }),
      })
    );

    const getReq = new Request(`http://localhost/api/organizer-applications?walletAddress=${testWallet}`);
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(401);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(false);
    expect(getJson.applications).toBeUndefined();
    expect(getRes.headers.get("cache-control")).toBe("no-store");
  });

  it("updates application status to approved with txHash via PATCH", async () => {
    const testWallet = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";
    const createRes = await POST(
      new Request("http://localhost/api/organizer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, walletAddress: testWallet, emailVerificationToken: issueOrganizerEmailProof(validPayload.contactEmail, testWallet).emailVerificationToken }),
      })
    );
    const createJson = await createRes.json();
    const appId = createJson.application.id;

    const dummyTx = `0x${"ab".repeat(32)}`;
    const reviewer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const patchReq = new Request("http://localhost/api/organizer-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appId,
        expectedUpdatedAt: createJson.application.updatedAt,
        status: "approved",
        txHash: dummyTx,
        reviewedBy: reviewer,
      }),
    });

    const patchRes = await PATCH(patchReq);
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.ok).toBe(true);
    expect(patchJson.application.status).toBe("approved");
    expect(publishNotificationChange).toHaveBeenCalledTimes(2);
    expect(patchJson.application.txHash).toBe(dummyTx);
    expect(patchJson.application.reviewedBy.toLowerCase()).toBe(reviewer.toLowerCase());
  });

  it("updates application status to revoked with revocationReason and txHash", async () => {
    const testWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const createRes = await POST(
      new Request("http://localhost/api/organizer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, walletAddress: testWallet, emailVerificationToken: issueOrganizerEmailProof(validPayload.contactEmail, testWallet).emailVerificationToken }),
      })
    );
    const createJson = await createRes.json();
    const appId = createJson.application.id;

    const dummyTx = `0x${"cd".repeat(32)}`;
    const reviewer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    // Attempt revoke while still pending -> should fail 409 because only approved can be revoked
    const unapprovedRevokeReq = new Request("http://localhost/api/organizer-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appId,
        expectedUpdatedAt: createJson.application.updatedAt,
        status: "revoked",
        txHash: dummyTx,
        reviewedBy: reviewer,
        revocationReason: "Vi phạm quy chế",
      }),
    });
    const unapprovedRes = await PATCH(unapprovedRevokeReq);
    expect(unapprovedRes.status).toBe(409);

    // Approve application first
    const approveReq = new Request("http://localhost/api/organizer-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appId,
        expectedUpdatedAt: createJson.application.updatedAt,
        status: "approved",
        txHash: dummyTx,
        reviewedBy: reviewer,
      }),
    });
    const approveRes = await PATCH(approveReq);
    expect(approveRes.status).toBe(200);
    const approvedJson = await approveRes.json();

    // Attempt revoke without reason -> should fail 400
    const failReq = new Request("http://localhost/api/organizer-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appId,
        expectedUpdatedAt: createJson.application.updatedAt,
        status: "revoked",
        txHash: dummyTx,
        reviewedBy: reviewer,
      }),
    });
    const failRes = await PATCH(failReq);
    expect(failRes.status).toBe(400);
    const failJson = await failRes.json();
    expect(failJson.error).toBe("REVOCATION_REASON_REQUIRED");

    // Revoke with valid reason -> should succeed
    const patchReq = new Request("http://localhost/api/organizer-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appId,
        expectedUpdatedAt: approvedJson.application.updatedAt,
        status: "revoked",
        txHash: dummyTx,
        reviewedBy: reviewer,
        revocationReason: "Vi phạm quy chế tổ chức sự kiện",
      }),
    });
    const patchRes = await PATCH(patchReq);
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.ok).toBe(true);
    expect(patchJson.application.status).toBe("revoked");
    expect(patchJson.application.revocationReason).toBe("Vi phạm quy chế tổ chức sự kiện");
  });
  it("rejects direct submissions that bypass email verification", async () => {
    const response = await POST(new Request("http://localhost/api/organizer-applications", {
      method: "POST", body: JSON.stringify({ ...validPayload, emailVerified: true }),
    }));
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ error: "EMAIL_NOT_VERIFIED" });
  });
  it("rejects proof issued for a different contact email", async () => {
    const response = await POST(new Request("http://localhost/api/organizer-applications", {
      method: "POST", body: JSON.stringify({ ...validPayload, emailVerificationToken: issueOrganizerEmailProof("other@gmail.com", sampleWallet).emailVerificationToken }),
    }));
    expect(response.status).toBe(403);
  });

});

it("rejects an old email proof after email ownership is bound to another wallet", async () => {
  const wallet=`0x${"3".repeat(40)}`; const email="already-used@school.edu.vn";
  vi.mocked(ensureEmailWallet).mockRejectedValueOnce(new VerificationError("EMAIL_ALREADY_USED",409));
  const response=await POST(new Request("http://localhost/api/organizer-applications",{method:"POST",body:JSON.stringify({walletAddress:wallet,organizationName:"Test Club",contactEmail:email,reason:"Organize a funding round",emailVerificationToken:issueOrganizerEmailProof(email,wallet).emailVerificationToken})}));
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({error:"EMAIL_ALREADY_USED"});
});

it("refuses direct PATCH calls that do not prove platform-owner authorization", async () => {
  vi.mocked(authorizeOrganizerReview).mockRejectedValueOnce(new VerificationError("ADMIN_SIGNATURE_REQUIRED", 403));
  const response = await PATCH(new Request("http://localhost/api/organizer-applications", { method: "PATCH", body: JSON.stringify({ id: "fixture", status: "approved" }) }));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: "ADMIN_SIGNATURE_REQUIRED" });
});

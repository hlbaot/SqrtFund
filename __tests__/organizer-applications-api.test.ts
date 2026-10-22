import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn().mockResolvedValue(undefined) }));

// Database double: the production service must never use per-instance memory.
const database = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as null | { code: string } }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: () => {
  let operation = "read";
  let values: Record<string, unknown> = {};
  const filters: [string, unknown][] = [];
  const execute = () => {
    if (database.error) return { data: null, error: database.error };
    let rows = database.rows.filter(row => filters.every(([key, value]) => row[key] === value));
    if (operation === "insert") { database.rows.push(values); rows = [values]; }
    if (operation === "update") rows.forEach(row => Object.assign(row, values));
    return { data: rows, error: null };
  };
  const query = {
    select: () => query, order: () => query,
    ilike: (key: string, value: string) => { filters.push([key, value]); return query; },
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    insert: (input: Record<string, unknown>) => { operation = "insert"; values = input; return query; },
    update: (input: Record<string, unknown>) => { operation = "update"; values = input; return query; },
    single: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
    maybeSingle: async () => query.single(),
    then: (resolve: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return query;
} }) }));

import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { VerificationError } from "@/lib/verify/errors";
import { issueOrganizerEmailProof } from "@/lib/server/organizerEmailProof";

beforeEach(() => vi.stubEnv("OTP_SECRET", "o".repeat(32)));
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

  it("retrieves applications via GET and filters by wallet", async () => {
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
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    expect(Array.isArray(getJson.applications)).toBe(true);
    expect(getJson.applications.some((a: { walletAddress: string }) => a.walletAddress.toLowerCase() === testWallet.toLowerCase())).toBe(true);
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

    const dummyTx = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const reviewer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const patchReq = new Request("http://localhost/api/organizer-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appId,
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
    expect(patchJson.application.txHash).toBe(dummyTx);
    expect(patchJson.application.reviewedBy.toLowerCase()).toBe(reviewer.toLowerCase());
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

it("returns a database failure instead of a successful empty list", async () => {
  database.error = { code: "42P01" };
  try {
    const response = await GET(new Request("http://localhost/api/organizer-applications"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, error: "DB_SCHEMA_MISMATCH" });
    const patch = await PATCH(new Request("http://localhost/api/organizer-applications", {
      method: "PATCH", body: JSON.stringify({ id: "existing", status: "approved" }),
    }));
    expect(patch.status).toBe(503);
  } finally { database.error = null; }
});
it("does not cache organizer application lists", async () => {
  const response = await GET(new Request("http://localhost/api/organizer-applications"));
  expect(response.headers.get("cache-control")).toBe("no-store");
});

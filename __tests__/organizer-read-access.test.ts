import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { ORGANIZER_READ_TTL_MS, organizerReadMessage, type OrganizerReadPermit } from "@/lib/organizerReadAccess";

const f = vi.hoisted(() => ({ owner: vi.fn(), chain: vi.fn(), list: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("viem", async importOriginal => {
  const actual = await importOriginal<typeof import("viem")>();
  return { ...actual, createPublicClient: () => ({ getChainId: f.chain, readContract: f.owner, verifyMessage: actual.verifyMessage }) };
});
vi.mock("@/lib/server/organizerApplications", () => ({
  listOrganizerApplications: f.list, createOrganizerApplication: vi.fn(),
  resubmitOrganizerApplication: vi.fn(), updateOrganizerApplicationStatus: vi.fn(),
}));
import { GET } from "@/app/api/organizer-applications/route";

const owner = privateKeyToAccount(`0x${"11".repeat(32)}`);
const alice = privateKeyToAccount(`0x${"22".repeat(32)}`);
const bob = privateKeyToAccount(`0x${"33".repeat(32)}`);
const factory = `0x${"4".repeat(40)}`;
const origin = "https://sqrt.test";
const now = Date.parse("2026-10-26T16:00:00Z");
const applications = [
  { id: "synthetic-alice", walletAddress: alice.address, contactEmail: "alice@example.invalid", reason: "Synthetic text", status: "pending" },
  { id: "synthetic-bob", walletAddress: bob.address, contactEmail: "bob@example.invalid", reason: "Synthetic text", status: "revoked" },
];

async function request(account = alice, query = `?walletAddress=${alice.address}`, changes: Partial<OrganizerReadPermit> = {}, signedBy = account) {
  const permit: OrganizerReadPermit = { walletAddress: account.address, origin, factory, chainId: 43113,
    issuedAt: now, expiresAt: now + ORGANIZER_READ_TTL_MS, nonce: "a".repeat(32), ...changes };
  const signature = await signedBy.signMessage({ message: organizerReadMessage(permit) });
  return new Request(`${origin}/api/organizer-applications${query}`, {
    headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ ...permit, signature })).toString("base64")}` },
  });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", factory); vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", "43113");
  f.chain.mockResolvedValue(43113); f.owner.mockResolvedValue(owner.address);
  f.list.mockImplementation(async ({ walletAddress, status }: { walletAddress?: string; status?: string }) =>
    applications.filter(app => (!walletAddress || app.walletAddress.toLowerCase() === walletAddress.toLowerCase())
      && (!status || app.status === status)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(["", `?walletAddress=${alice.address}`, "?status=revoked"])("rejects anonymous reads before querying data: %s", async query => {
  const response = await GET(new Request(`${origin}/api/organizer-applications${query}`));
  expect(response.status).toBe(401);
  expect(await response.json()).not.toHaveProperty("applications");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(f.list).not.toHaveBeenCalled(); expect(f.chain).not.toHaveBeenCalled();
});
it("allows a wallet with a real signature to read only its own applications", async () => {
  const response = await GET(await request());
  expect(response.status).toBe(200);
  expect((await response.json()).applications).toEqual([applications[0]]);
  expect(f.owner).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
});
it.each(["", `?walletAddress=${bob.address}`, "?status=revoked"])("rejects non-owner attempts to read other/all applications: %s", async query => {
  const response = await GET(await request(alice, query));
  expect(response.status).toBe(403); expect(f.list).not.toHaveBeenCalled();
  expect(await response.json()).not.toHaveProperty("applications");
});
it("allows the current owner to list, filter and inspect another wallet", async () => {
  let response = await GET(await request(owner, ""));
  expect(response.status).toBe(200); expect((await response.json()).applications).toHaveLength(2);
  response = await GET(await request(owner, "?status=revoked"));
  expect((await response.json()).applications).toEqual([applications[1]]);
  response = await GET(await request(owner, `?walletAddress=${alice.address}`));
  expect((await response.json()).applications).toEqual([applications[0]]);
});
it("rejects a previous owner's credential after Factory ownership changes", async () => {
  const signed = await request(owner, "");
  f.owner.mockResolvedValue(bob.address);
  expect((await GET(signed)).status).toBe(403); expect(f.list).not.toHaveBeenCalled();
});
it("rejects a signature made by a different wallet", async () => {
  expect((await GET(await request(alice, undefined, {}, bob))).status).toBe(401);
  expect(f.list).not.toHaveBeenCalled();
});
it.each([
  { origin: "https://other.test" }, { factory: `0x${"5".repeat(40)}` }, { chainId: 1 },
  { issuedAt: now + 30_001, expiresAt: now + 30_001 + ORGANIZER_READ_TTL_MS },
  { expiresAt: now + ORGANIZER_READ_TTL_MS + 1 }, { nonce: "not-random-hex" },
])("rejects credentials for the wrong context or lifetime: %j", async changes => {
  expect((await GET(await request(alice, undefined, changes))).status).toBe(401);
  expect(f.list).not.toHaveBeenCalled();
});
it("rejects an expired credential and does not extend its lifetime on reuse", async () => {
  const first = await request();
  expect((await GET(first.clone())).status).toBe(200);
  f.list.mockClear(); vi.setSystemTime(now + ORGANIZER_READ_TTL_MS);
  expect((await GET(first)).status).toBe(401); expect(f.list).not.toHaveBeenCalled();
});
it("rejects a tampered signed wallet", async () => {
  const signed = await request();
  const payload = JSON.parse(Buffer.from(signed.headers.get("authorization")!.slice(7), "base64").toString());
  payload.walletAddress = owner.address;
  const response = await GET(new Request(`${origin}/api/organizer-applications`, {
    headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify(payload)).toString("base64")}` },
  }));
  expect(response.status).toBe(401); expect(f.list).not.toHaveBeenCalled();
});
it.each(["Bearer not-json", "Bearer bnVsbA==", "Bearer W10=", "Basic ZmFrZQ==", `Bearer ${"a".repeat(5000)}`])("rejects malformed credentials", async token => {
  const response = await GET(new Request(`${origin}/api/organizer-applications`, { headers: { Authorization: token } }));
  expect(response.status).toBe(401); expect(f.list).not.toHaveBeenCalled();
});
it("fails closed for RPC errors, wrong RPC chain and missing configuration", async () => {
  f.chain.mockRejectedValueOnce(new Error("Unavailable"));
  expect((await GET(await request())).status).toBe(503);
  f.chain.mockResolvedValueOnce(1);
  expect((await GET(await request())).status).toBe(503);
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", "");
  expect((await GET(await request())).status).toBe(503);
  expect(f.list).not.toHaveBeenCalled();
});
it("does not expose application data or errors when database reading fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  f.list.mockRejectedValueOnce(new Error("synthetic private backend text"));
  const response = await GET(await request());
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: false, error: "INTERNAL_ERROR" });
});

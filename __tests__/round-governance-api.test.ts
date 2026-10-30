import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ authorize: vi.fn(), chain: vi.fn(), single: vi.fn(), order: vi.fn(), insert: vi.fn(), policy: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/roundGovernance", () => ({ authorizeGovernance: f.authorize, governanceChain: f.chain }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: () => ({ select: () => {
  const builder = { eq: () => builder, order: f.order, maybeSingle: f.policy }; return builder;
}, insert: (row: unknown) => { f.insert(row); return { select: () => ({ single: f.single }) }; } }) }) }));
import { GET, POST } from "@/app/api/round-governance/route";
import { RULES_VERSION } from "@/lib/roundGovernance";
import { VerificationError } from "@/lib/verify/errors";
const round = `0x${"1".repeat(40)}`;
const body = () => ({ kind: "policy", round, rulesVersion: RULES_VERSION, policy: { theme: "Theme", eligibility: "Students", funding: "Materials", criteria: "Feasible" }, permit: {}, signature: "signature" });
const request = (value: unknown = body()) => new Request("https://sqrt.test/api/round-governance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); f.authorize.mockResolvedValue(`0x${"2".repeat(40)}`); f.chain.mockResolvedValue({}); f.single.mockResolvedValue({ data: { id: 1 }, error: null }); f.order.mockResolvedValue({ data: [], error: null }); f.policy.mockResolvedValue({ data: null, error: null }); });
it("returns persisted records and an honest empty list", async () => {
  const r = await GET(new Request(`https://sqrt.test/api/round-governance?round=${round}`));
  expect(r.status).toBe(200); expect(await r.json()).toEqual({ records: [] });
});
it("never treats database failure as an empty policy", async () => {
  f.order.mockResolvedValue({ data: null, error: { code: "42P01" } });
  expect((await GET(new Request(`https://sqrt.test/api/round-governance?round=${round}`))).status).toBe(503);
});
it("requires authorization before writing and rejects cross-origin requests", async () => {
  f.authorize.mockRejectedValue(new VerificationError("GOVERNANCE_FORBIDDEN", 403));
  expect((await POST(request())).status).toBe(403); expect(f.insert).not.toHaveBeenCalled();
  const r = new Request("https://sqrt.test/api/round-governance", { method: "POST", headers: { Origin: "https://other.test" }, body: JSON.stringify(body()) });
  expect((await POST(r)).status).toBe(401);
});
it("keeps duplicate publications immutable and does not acknowledge missing database writes", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(f.insert.mock.calls[0][0]).toMatchObject({ entry_key: "policy", round_address: round });
  f.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
  expect((await POST(request())).status).toBe(409);
  f.single.mockResolvedValueOnce({ data: null, error: null });
  expect((await POST(request())).status).toBe(503);
});
it("rejects malformed or oversized content before authorization", async () => {
  expect((await POST(request({}))).status).toBe(400);
  expect((await POST(request({ junk: "x".repeat(65537) }))).status).toBe(413);
  expect(f.authorize).not.toHaveBeenCalled();
});

it("enforces round category eligibility and never writes when the policy read fails", async () => {
  const category = { kind: "category", round, rulesVersion: RULES_VERSION, projectId: "1", category: "community" };
  f.policy.mockResolvedValueOnce({ data: { payload: { ...body(), policy: { ...body().policy, categories: ["technology"] } } }, error: null });
  expect((await POST(request(category))).status).toBe(409); expect(f.insert).not.toHaveBeenCalled();
  f.policy.mockResolvedValueOnce({ data: null, error: { code: "DB_DOWN" } });
  expect((await POST(request(category))).status).toBe(503); expect(f.insert).not.toHaveBeenCalled();
  expect((await POST(request(category))).status).toBe(200);
  expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({ kind: "category", entry_key: "category:1", transaction_hash: null }));
});

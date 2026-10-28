import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  authorize: vi.fn(),
  read: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/projectProfileAuthorization", () => ({
  authorizeProfile: f.authorize,
  readProfileProject: f.read,
}));
vi.mock("@/lib/verify/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ rpc: f.rpc, from: f.from }),
}));
import { GET, PUT } from "@/app/api/project-profile/route";
import { VerificationError } from "@/lib/verify/errors";
const data = {
  round: `0x${"2".repeat(40)}`,
  projectId: "1",
  revision: 0,
  profile: {
    leadName: "Student lead",
    goal: "Provide kits",
    budgetUsdc: "12.5",
    budgetPlan: "Kits",
    milestones: "10 kits",
  },
};
const req = (body: unknown = data) =>
  new Request("https://sqrt.test/api/project-profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  f.authorize.mockResolvedValue(`0x${"1".repeat(40)}`);
  f.read.mockResolvedValue({});
  const b = { select: () => b, eq: () => b, maybeSingle: f.single };
  f.from.mockReturnValue(b);
  f.single.mockResolvedValue({ data: null, error: null });
  f.rpc.mockResolvedValue({
    data: {
      status: "OK",
      document: { profile: data.profile, reports: [], revision: 1 },
    },
    error: null,
  });
});
it("returns an empty profile only for a successful database read", async () => {
  const request = new Request(
    `https://sqrt.test/api/project-profile?round=${data.round}&projectId=1`,
  );
  expect(await (await GET(request)).json()).toEqual({ document: null });
  f.single.mockResolvedValue({ data: null, error: Error("DB down") });
  const r = await GET(request);
  expect(r.status).toBe(503);
  expect(await r.json()).not.toHaveProperty("document");
});
it("does not write or return success after failed authorization", async () => {
  f.authorize.mockRejectedValue(
    new VerificationError("PROFILE_AUTH_INVALID", 401),
  );
  expect((await PUT(req())).status).toBe(401);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("persists via atomic revision RPC and returns the persisted acknowledgment", async () => {
  const response = await PUT(req());
  expect(response.status).toBe(200);
  expect((await response.json()).document.revision).toBe(1);
  expect(f.rpc).toHaveBeenCalledWith(
    "save_project_profile",
    expect.objectContaining({ p_revision: 0, p_profile: data.profile }),
  );
});
it("reports revision conflicts and database failure without claiming saved", async () => {
  f.rpc.mockResolvedValueOnce({ data: { status: "CONFLICT" }, error: null });
  expect((await PUT(req())).status).toBe(409);
  f.rpc.mockResolvedValueOnce({ data: null, error: Error("DB down") });
  const response = await PUT(req());
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty("document");
});
it("rejects oversized bodies and cross-origin requests before any side effects", async () => {
  expect((await PUT(req({ x: "x".repeat(66000) }))).status).toBe(413);
  const foreign = new Request("https://sqrt.test/api/project-profile", {
    method: "PUT",
    headers: { Origin: "https://foreign.test" },
    body: JSON.stringify(data),
  });
  expect((await PUT(foreign)).status).toBe(401);
  expect(f.authorize).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});

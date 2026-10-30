import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  PROFILE_TTL,
  parseProfileChange,
  profileMessage,
} from "@/lib/projectProfile";
import { projectFunding } from "@/lib/projectFunding";
const f = vi.hoisted(() => ({ read: vi.fn(), chain: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("viem", async (original) => ({
  ...(await original<typeof import("viem")>()),
  createPublicClient: () => ({ readContract: f.read, getChainId: f.chain }),
}));
import {
  authorizeProfile,
  readProfileProject,
} from "@/lib/server/projectProfileAuthorization";
const account = privateKeyToAccount(`0x${"11".repeat(32)}`);
const round = `0x${"2".repeat(40)}`,
  factory = `0x${"3".repeat(40)}`;
const change = () =>
  parseProfileChange({
    round,
    projectId: "1",
    revision: 0,
    profile: {
      leadName: "Team lead",
      goal: "Support students",
      budgetUsdc: "12.50",
      budgetPlan: "Materials: 10; transport: 2.50 USDC",
      milestones: "Deliver 10 kits",
    },
  });
const request = () => new Request("https://sqrt.test/api/project-profile");
const permit = () => {
  const now = Date.now();
  return {
    wallet: account.address,
    origin: "https://sqrt.test",
    chainId: 43113,
    issuedAt: now,
    expiresAt: now + PROFILE_TTL,
  };
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", factory);
  f.chain.mockResolvedValue(43113);
  f.read.mockImplementation(
    async ({ functionName }: { functionName: string }) =>
      functionName === "getRounds"
        ? [round]
        : functionName === "rejected"
          ? false
          : [
              [
                {
                  id: 1n,
                  owner: account.address,
                  approved: true,
                  claimed: false,
                },
              ],
              1n,
            ],
  );
});
afterEach(() => vi.unstubAllEnvs());
it("distinguishes estimated, unknown settlement, final and cancelled funding", () => {
  const project = {
    status: "approved" as const,
    totalDonated: 5,
    estimatedMatching: 10,
    finalMatching: 3,
  };
  expect(projectFunding(project)).toEqual({
    direct: 5,
    matching: 10,
    total: 15,
  });
  expect(
    projectFunding({ ...project, finalMatching: undefined }, true).total,
  ).toBeUndefined();
  expect(projectFunding(project, true).total).toBe(8);
  expect(
    projectFunding({ ...project, matchingUnavailable: true }).matching,
  ).toBeUndefined();
  expect(projectFunding(project, true, true).matching).toBe(0);
});
it("accepts a valid owner signature bound to the whole profile and revision", async () => {
  const p = permit(),
    c = change();
  const sig = await account.signMessage({ message: profileMessage(c, p) });
  expect(await authorizeProfile(request(), c, p, sig)).toBe(
    account.address.toLowerCase(),
  );
  await expect(
    authorizeProfile(request(), { ...c, revision: 1 }, p, sig),
  ).rejects.toMatchObject({ status: 401 });
  await expect(
    authorizeProfile(
      request(),
      { ...c, profile: { ...c.profile, budgetUsdc: "999" } },
      p,
      sig,
    ),
  ).rejects.toMatchObject({ status: 401 });
});
it("rejects expired or cross-origin signed requests", async () => {
  const c = change(),
    p = {
      ...permit(),
      issuedAt: Date.now() - PROFILE_TTL - 1000,
      expiresAt: Date.now() - 1000,
    };
  await expect(
    authorizeProfile(
      request(),
      c,
      p,
      await account.signMessage({ message: profileMessage(c, p) }),
    ),
  ).rejects.toMatchObject({ status: 401 });
  const foreign = { ...permit(), origin: "https://foreign.test" };
  await expect(
    authorizeProfile(
      request(),
      c,
      foreign,
      await account.signMessage({ message: profileMessage(c, foreign) }),
    ),
  ).rejects.toMatchObject({ status: 401 });
  expect(f.read).not.toHaveBeenCalled();
});
it("rejects another wallet even when its signature is valid", async () => {
  const other = privateKeyToAccount(`0x${"22".repeat(32)}`),
    p = { ...permit(), wallet: other.address },
    c = change();
  await expect(
    authorizeProfile(
      request(),
      c,
      p,
      await other.signMessage({ message: profileMessage(c, p) }),
    ),
  ).rejects.toMatchObject({ status: 403 });
});
it("does not expose proposals for arbitrary contracts or pending projects", async () => {
  f.read.mockResolvedValueOnce([]);
  await expect(readProfileProject(round, "1")).rejects.toMatchObject({
    status: 404,
  });
  f.read.mockImplementation(async ({ functionName }) =>
    functionName === "getRounds"
      ? [round]
      : functionName === "rejected"
        ? false
        : [[{ id: 1n, owner: account.address, approved: false }], 1n],
  );
  await expect(readProfileProject(round, "1")).rejects.toMatchObject({
    status: 404,
  });
});
it("blocks reports before claim and fails closed when chain reads fail", async () => {
  const c = { ...change(), report: { text: "Progress", evidenceUrl: "" } },
    p = permit(),
    sig = await account.signMessage({ message: profileMessage(c, p) });
  await expect(authorizeProfile(request(), c, p, sig)).rejects.toMatchObject({
    status: 409,
  });
  f.chain.mockRejectedValueOnce(Error("RPC down"));
  await expect(readProfileProject(round, "1")).rejects.toMatchObject({
    status: 503,
  });
});
it.each(["0", "-1", "NaN", "1.0000001"])(
  "rejects an invalid budget %s",
  (budgetUsdc) => {
    const c = change();
    expect(() =>
      parseProfileChange({ ...c, profile: { ...c.profile, budgetUsdc } }),
    ).toThrow();
  },
);
it("rejects executable evidence links and missing proposal fields", () => {
  expect(() =>
    parseProfileChange({
      ...change(),
      report: { text: "Report", evidenceUrl: "javascript:alert(1)" },
    }),
  ).toThrow();
  expect(() =>
    parseProfileChange({
      ...change(),
      profile: { ...change().profile, leadName: "" },
    }),
  ).toThrow();
});
it("keeps legacy proposals compatible and validates optional highlights", () => {
  const legacy = change();
  expect(legacy.profile).not.toHaveProperty("progress");
  const expanded = parseProfileChange({ ...legacy, profile: { ...legacy.profile, differentiator: "  Open design  ", progress: "Prototype ready" } });
  expect(expanded.profile.differentiator).toBe("Open design");
  expect(expanded.profile.progress).toBe("Prototype ready");
  expect(() => parseProfileChange({ ...legacy, profile: { ...legacy.profile, progress: "x".repeat(2001) } })).toThrow("INVALID_PROFILE");
});
it("binds sponsor highlights to the owner signature", async () => {
  const c = parseProfileChange({ ...change(), profile: { ...change().profile, progress: "Prototype" } });
  const p = permit();
  const sig = await account.signMessage({ message: profileMessage(c, p) });
  await expect(authorizeProfile(request(), { ...c, profile: { ...c.profile, progress: "Altered" } }, p, sig)).rejects.toMatchObject({ status: 401 });
});

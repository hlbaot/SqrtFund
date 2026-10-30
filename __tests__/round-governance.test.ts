import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { encodeEventTopics } from "viem";
import { parseGovernance, governanceMessage, RULES_VERSION } from "@/lib/roundGovernance";
import { PROFILE_TTL } from "@/lib/projectProfile";
import { qfRoundAbi } from "@/lib/contracts/abis";
const f = vi.hoisted(() => ({ read: vi.fn(), chain: vi.fn(), receipt: vi.fn(), block: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("viem", async original => ({ ...(await original<typeof import("viem")>()), createPublicClient: () => ({ readContract: f.read, getChainId: f.chain, getTransactionReceipt: f.receipt, getBlock: f.block }) }));
import { authorizeGovernance, governanceChain } from "@/lib/server/roundGovernance";
const owner = privateKeyToAccount(`0x${"11".repeat(32)}`);
const other = privateKeyToAccount(`0x${"22".repeat(32)}`);
const round = `0x${"3".repeat(40)}`;
const factory = `0x${"4".repeat(40)}`;
const hash = `0x${"a".repeat(64)}`;
const policy = () => parseGovernance({ kind: "policy", round, rulesVersion: RULES_VERSION, policy: { theme: "Community", eligibility: "Students", funding: "Materials", criteria: "Feasible milestones" } });
const review = () => parseGovernance({ kind: "review", round, rulesVersion: RULES_VERSION, review: { projectId: "1", action: "approve", criteria: ["fit", "budget"], reason: "Clear budget and community fit" } });
function permit() { const issuedAt = Date.now(); return { wallet: owner.address, chainId: 43113, origin: "https://sqrt.test", issuedAt, expiresAt: issuedAt + PROFILE_TTL }; }
const request = () => new Request("https://sqrt.test/api/round-governance");
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", factory);
  f.chain.mockResolvedValue(43113); f.block.mockResolvedValue({ timestamp: 100n });
  f.read.mockImplementation(async ({ functionName }) => ({ getRounds: [round], admin: owner.address, projectCount: 0n, endTime: 200n, finalized: false, isCancelled: false })[functionName as "getRounds"]);
  f.receipt.mockResolvedValue({ status: "success", from: owner.address, to: round, logs: [{ address: round, data: "0x", topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "ProjectApproved", args: { id: 1n } }) }] });
});
afterEach(() => vi.unstubAllEnvs());
it("accepts an organizer-signed policy for an empty active round", async () => {
  const c = policy(), p = permit();
  expect(await authorizeGovernance(request(), c, p, await owner.signMessage({ message: governanceMessage(c, p) }), undefined)).toBe(owner.address.toLowerCase());
});
it.each(["projectCount", "finalized", "isCancelled", "endTime"])("blocks publication when %s locks the round", async field => {
  const base = f.read.getMockImplementation()!;
  f.read.mockImplementation(async args => args.functionName === field ? ({ projectCount: 1n, finalized: true, isCancelled: true, endTime: 100n })[field as "endTime"] : base(args));
  const c = policy(), p = permit();
  await expect(authorizeGovernance(request(), c, p, await owner.signMessage({ message: governanceMessage(c, p) }), undefined)).rejects.toMatchObject({ code: "POLICY_LOCKED" });
});
it("rejects non-owner wallets even with valid signatures", async () => {
  const c = policy(), p = { ...permit(), wallet: other.address };
  await expect(authorizeGovernance(request(), c, p, await other.signMessage({ message: governanceMessage(c, p) }), undefined)).rejects.toMatchObject({ status: 403 });
});
it("rejects tampering, expired permits and another origin", async () => {
  const c = review(), p = permit(), sig = await owner.signMessage({ message: governanceMessage(c, p) });
  const altered = parseGovernance({ ...c, review: { ...(c.kind === "review" ? c.review : {}), reason: "Changed" } });
  for (const [change, token] of [[altered, p], [c, { ...p, origin: "https://other.test" }], [c, { ...p, issuedAt: Date.now() - PROFILE_TTL - 1000, expiresAt: Date.now() - 1000 }]] as const) {
    await expect(authorizeGovernance(request(), change, token, sig, hash)).rejects.toMatchObject({ status: 401 });
  }
  expect(f.read).not.toHaveBeenCalled();
});
it("requires a successful matching project event emitted by the exact round", async () => {
  const c = review(), p = permit(), sig = await owner.signMessage({ message: governanceMessage(c, p) });
  expect(await authorizeGovernance(request(), c, p, sig, hash)).toBe(owner.address.toLowerCase());
  const valid = await f.receipt();
  for (const patch of [{ status: "reverted" }, { from: other.address }, { to: factory }, { logs: [] }, { logs: [{ ...valid.logs[0], address: factory }] }, { logs: [{ ...valid.logs[0], topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "ProjectApproved", args: { id: 2n } }) }] }]) {
    f.receipt.mockResolvedValueOnce({ ...valid, ...patch });
    await expect(authorizeGovernance(request(), c, p, sig, hash)).rejects.toMatchObject({ code: "REVIEW_RECEIPT_INVALID" });
  }
  await expect(authorizeGovernance(request(), c, p, sig, "bad")).rejects.toMatchObject({ code: "REVIEW_RECEIPT_REQUIRED" });
});
it("rejects an approval receipt for a rejection explanation", async () => {
  const c = parseGovernance({ ...review(), review: { projectId: "1", action: "reject", criteria: ["fit"], reason: "Outside theme" } }), p = permit();
  await expect(authorizeGovernance(request(), c, p, await owner.signMessage({ message: governanceMessage(c, p) }), hash)).rejects.toMatchObject({ code: "REVIEW_RECEIPT_INVALID" });
});
it("rejects arbitrary rounds and wrong-chain reads", async () => {
  f.read.mockResolvedValueOnce([]);
  await expect(governanceChain(round)).rejects.toMatchObject({ status: 404 });
  f.chain.mockResolvedValueOnce(1);
  await expect(governanceChain(round)).rejects.toMatchObject({ status: 503 });
});
it.each([[], ["unknown"], ["budget", "budget"]].map(criteria => ({ criteria })))("rejects invalid review criteria $criteria", ({ criteria }) => {
  expect(() => parseGovernance({ ...review(), review: { projectId: "1", action: "approve", criteria, reason: "Explanation" } })).toThrow();
});
it("rejects missing policy fields, oversized reasons and invalid scope/version", () => {
  expect(() => parseGovernance({ ...policy(), policy: { theme: "" } })).toThrow();
  expect(() => parseGovernance({ ...policy(), round: "invalid" })).toThrow();
  expect(() => parseGovernance({ ...policy(), rulesVersion: "old" })).toThrow();
  expect(() => parseGovernance({ ...review(), review: { projectId: "1", action: "reject", criteria: ["fit"], reason: "x".repeat(2001) } })).toThrow();
});
it("validates round categories without changing legacy signed policy content", () => {
  const old = policy(); expect(old.kind === "policy" && old.policy).not.toHaveProperty("categories");
  const expanded = parseGovernance({ ...old, policy: { ...(old.kind === "policy" ? old.policy : {}), categories: ["community", "technology"] } });
  expect(expanded.kind === "policy" && expanded.policy.categories).toEqual(["community", "technology"]);
  for (const categories of [[], ["uncategorized"], ["technology", "technology"]]) expect(() => parseGovernance({ ...old, policy: { ...(old.kind === "policy" ? old.policy : {}), categories } })).toThrow();
});
it("lets the actual project owner publish a category and blocks other wallets", async () => {
  const c = parseGovernance({ kind: "category", round, rulesVersion: RULES_VERSION, projectId: "1", category: "community" });
  const base = f.read.getMockImplementation()!;
  f.read.mockImplementation(async args => args.functionName === "getProjects" ? [[{ id: 1n, owner: owner.address }], 1n] : base(args));
  const p = permit();
  expect(await authorizeGovernance(request(), c, p, await owner.signMessage({ message: governanceMessage(c, p) }), undefined)).toBe(owner.address.toLowerCase());
  const foreign = { ...p, wallet: other.address };
  await expect(authorizeGovernance(request(), c, foreign, await other.signMessage({ message: governanceMessage(c, foreign) }), undefined)).rejects.toMatchObject({ status: 403 });
  f.read.mockImplementation(async args => args.functionName === "getProjects" ? [[], 1n] : base(args));
  await expect(authorizeGovernance(request(), c, p, await owner.signMessage({ message: governanceMessage(c, p) }), undefined)).rejects.toMatchObject({ status: 404 });
});
it("binds the category and project ID to its owner's signature", async () => {
  const c = parseGovernance({ kind: "category", round, rulesVersion: RULES_VERSION, projectId: "1", category: "community" }), p = permit();
  const sig = await owner.signMessage({ message: governanceMessage(c, p) });
  await expect(authorizeGovernance(request(), parseGovernance({ ...c, category: "arts" }), p, sig, undefined)).rejects.toMatchObject({ status: 401 });
  await expect(authorizeGovernance(request(), parseGovernance({ ...c, projectId: "2" }), p, sig, undefined)).rejects.toMatchObject({ status: 401 });
});

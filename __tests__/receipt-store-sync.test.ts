import { afterEach, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Address, type TransactionReceipt } from "viem";
import { qfRoundAbi, roundFactoryAbi } from "@/lib/contracts/abis";
import { patchReceipt, readMirrorSnapshot } from "@/lib/store/chainSync";
import { roundsStore, projectsStore, organizerStore, storedProject, projectKey } from "@/lib/store";
import { SCALE, sqrtBigInt } from "@/lib/qf";
import type { EnrichedProject } from "@/hooks/useProjects";
const factory = `0x${"f".repeat(40)}` as Address, round = `0x${"a".repeat(40)}` as Address, wallet = `0x${"b".repeat(40)}` as Address;
vi.mock("@/lib/contracts/addresses", () => ({ factoryAddress: `0x${"f".repeat(40)}`, TARGET_CHAIN_ID: 43113 }));
const hash = `0x${"1".repeat(64)}` as const;
const receipt = (logs: unknown[]) => ({ transactionHash: hash, blockNumber: 20n, gasUsed: 12n, effectiveGasPrice: 15n, status: "success", logs } as unknown as TransactionReceipt);
function seed() {
  const results = Array.from({ length: 17 }, () => ({ status: "success" as const, result: 0n as unknown }));
  results[8].result = false; results[15].result = false;
  roundsStore.getState().upsert({ id: round, address: round, fields: { version: "current", results }, confirmedBlock: 10n });
  projectsStore.getState().upsert(storedProject({ id: "1", contractId: 1n, roundId: round, ownerAddress: wallet, name: "Project", description: "", shortDescription: "", category: "technology", contactUrl: "", status: "pending", approved: false, rejected: false, claimed: false, totalDonated: 0, supporterCount: 0, estimatedMatching: 0, sumSqrtRaw: 0n, totalDonatedRaw: 0n, estimatedMatchingRaw: 0n } as EnrichedProject));
}
function project() { return projectsStore.getState().projectsByRound[round][0]; }
afterEach(() => { roundsStore.getState().reset(); projectsStore.getState().reset(); organizerStore.getState().reset(); });
it("registers a pending project only from a known round and removes it on rollback", () => {
  seed(); const log = { address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "ProjectRegistered", args: { id: 2n, owner: wallet } }), data: encodeAbiParameters([{ type: "string" }], ["Fresh proposal"]) };
  const plan = patchReceipt(receipt([log])); expect(projectsStore.getState().projectsByRound[round][1]).toMatchObject({ id: "2", name: "Fresh proposal", status: "pending" });
  [...plan.changes].reverse().forEach(c => c.rollback()); expect(projectsStore.getState().projectsByRound[round]).toHaveLength(1);
  patchReceipt(receipt([{ ...log, address: factory }])); expect(projectsStore.getState().projectsByRound[round]).toHaveLength(1);
});
it.each(["ProjectApproved", "ProjectRejected"] as const)("immediately applies %s then rolls back", eventName => {
  seed(); const plan = patchReceipt(receipt([{ address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName, args: { id: 1n } }), data: "0x" }]));
  expect(project().status).toBe(eventName === "ProjectApproved" ? "approved" : "rejected");
  [...plan.changes].reverse().forEach(c => c.rollback()); expect(project().status).toBe("pending");
});
it("uses Donated.newTotal as the donor's cumulative contribution, not the project total, and handles repeat donations/refunds", () => {
  seed(); const donorLog = (amount: bigint, newTotal: bigint) => ({ address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "Donated", args: { donor: wallet, projectId: 1n } }), data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [amount, newTotal]) });
  patchReceipt(receipt([donorLog(4_000_000n, 4_000_000n)])); patchReceipt(receipt([donorLog(5_000_000n, 9_000_000n)]));
  expect(project()).toMatchObject({ totalDonatedRaw: 9_000_000n, totalDonated: 9, supporterCount: 1 });
  expect(project().sumSqrtRaw).toBe(sqrtBigInt(9_000_000n * SCALE));
  patchReceipt(receipt([{ address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "Refunded", args: { donor: wallet, projectId: 1n } }), data: encodeAbiParameters([{ type: "uint256" }], [9_000_000n]) }]));
  expect(project()).toMatchObject({ totalDonatedRaw: 0n, supporterCount: 0, sumSqrtRaw: 0n });
});
it("updates finalize, claim, cancellation and pool statistics from receipt events", () => {
  seed(); const events = [
    { address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "Finalized" }), data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [80n, 20n]) },
    { address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "Claimed", args: { projectId: 1n, owner: wallet } }), data: encodeAbiParameters([{ type: "uint256" }], [80n]) },
    { address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "RoundCancelled", args: { admin: wallet } }), data: "0x" },
    { address: round, topics: encodeEventTopics({ abi: qfRoundAbi, eventName: "PoolDeposited", args: { depositor: wallet } }), data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [100n, 200n]) },
  ];
  patchReceipt(receipt(events)); const fields = roundsStore.getState().entities[round].fields!.results;
  expect(fields[8].result).toBe(true); expect(fields[9].result).toBe(20n); expect(fields[15].result).toBe(true); expect(fields[7].result).toBe(200n); expect(project().claimed).toBe(true);
});
it("accepts organizer permission events only from the configured Factory", () => {
  const log = { address: factory, topics: encodeEventTopics({ abi: roundFactoryAbi, eventName: "OrganizerUpdated", args: { organizer: wallet } }), data: encodeAbiParameters([{ type: "bool" }], [true]) };
  patchReceipt(receipt([{ ...log, address: round }])); expect(organizerStore.getState().entities[wallet]).toBeUndefined();
  patchReceipt(receipt([log])); expect(organizerStore.getState().entities[wallet]).toMatchObject({ authorized: true, confirmedBlock: 20n });
});
it("never overwrites a permission already confirmed at a newer block", async () => {
  organizerStore.getState().upsert({ id: wallet, authorized: false, confirmedBlock: 30n });
  const client = { readContract: vi.fn().mockResolvedValue(true) };
  const publish = await readMirrorSnapshot(client as never, [], [wallet], 20n); publish();
  expect(organizerStore.getState().entities[wallet].authorized).toBe(false);
  expect(projectKey(round, 1n)).toBe(`${round}:1`);
});

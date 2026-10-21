import { describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Address, type Log } from "viem";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { createdRoundAddress, fundRound, parseInitialPool } from "@/lib/roundFunding";

describe("initial round matching pool", () => {
  it.each(["", "  ", "0", "0.000000"])("allows %s to create without funding", input => {
    expect(parseInitialPool(input)).toMatchObject({ success: true, amount: 0n });
  });
  it("validates exact micro-USDC precision and wallet balance", () => {
    expect(parseInitialPool("123.000001", 124_000_000n)).toMatchObject({ success: true, amount: 123_000_001n });
    expect(parseInitialPool("1.0000001")).toMatchObject({ success: false, errorKey: "too_many_decimals" });
    expect(parseInitialPool("-1")).toMatchObject({ success: false, errorKey: "negative" });
    expect(parseInitialPool("100", 99_000_000n)).toMatchObject({ success: false, errorKey: "exceeds_balance" });
  });
  const approvalHash = "0x01" as const, depositHash = "0x02" as const;
  function actions(allowance = 0n) {
    return { allowance: vi.fn(async () => allowance), approve: vi.fn(async () => approvalHash),
      deposit: vi.fn(async () => depositHash), confirm: vi.fn<(hash: `0x${string}`) => Promise<void>>(async () => {}) };
  }
  it("skips all funding requests for an empty initial pool", async () => {
    const a = actions(); await fundRound(0n, a);
    for (const call of Object.values(a)) expect(call).not.toHaveBeenCalled();
  });
  it("confirms approval before depositing, then waits for the deposit receipt", async () => {
    const a = actions(); await fundRound(10n, a);
    expect(a.confirm.mock.calls).toEqual([[approvalHash], [depositHash]]);
    expect(a.confirm.mock.invocationCallOrder[0]).toBeLessThan(a.deposit.mock.invocationCallOrder[0]);
  });
  it("skips approval if allowance already covers the amount", async () => {
    const a = actions(10n); await fundRound(10n, a);
    expect(a.approve).not.toHaveBeenCalled(); expect(a.confirm).toHaveBeenCalledWith(depositHash);
  });
  it("does not deposit if approval is rejected or reverts", async () => {
    for (const failedStage of ["approve", "confirm"] as const) {
      const a = actions(); a[failedStage].mockRejectedValueOnce(new Error("rejected"));
      await expect(fundRound(10n, a)).rejects.toThrow("rejected");
      expect(a.deposit).not.toHaveBeenCalled();
    }
  });
  it("reports an unsuccessful deposit so the already-created round can be funded later", async () => {
    const a = actions(10n); a.confirm.mockRejectedValueOnce(new Error("deposit reverted"));
    await expect(fundRound(10n, a)).rejects.toThrow("deposit reverted");
    expect(a.deposit).toHaveBeenCalledTimes(1);
  });
});

describe("created round address", () => {
  const factory: Address = "0x1111111111111111111111111111111111111111";
  const admin: Address = "0x2222222222222222222222222222222222222222";
  const token: Address = "0x3333333333333333333333333333333333333333";
  const deployed: Address = "0x4444444444444444444444444444444444444444";
  const log = (emitter = factory, owner = admin, asset = token): Log => ({
    address: emitter,
    topics: encodeEventTopics({ abi: roundFactoryAbi, eventName: "RoundCreated", args: { roundAddress: deployed, admin: owner } }) as Log["topics"],
    data: encodeAbiParameters([{ type: "address" }, { type: "string" }], [asset, "New round"]),
    blockHash: null, blockNumber: null, transactionHash: null, transactionIndex: null, logIndex: null, removed: false,
  });
  it("uses only the matching deployment event from this factory and wallet", () => {
    expect(createdRoundAddress([log(token), log(factory, token), log(factory, admin, admin), log()], factory, admin, token)?.toLowerCase()).toBe(deployed);
    expect(createdRoundAddress([], factory, admin, token)).toBeUndefined();
    expect(createdRoundAddress([log(token)], factory, admin, token)).toBeUndefined();
  });
});

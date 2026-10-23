import { describe, expect, it, vi } from "vitest";
import { canAutoFinalize, finalizeEligibleRounds } from "../scripts/keeper/finalize.mjs";

const factory = `0x${"1".repeat(40)}`;
const round = `0x${"2".repeat(40)}`;
const other = `0x${"3".repeat(40)}`;
const account = { address: `0x${"4".repeat(40)}` };
const state = { endTime: 1000n, grace: 86400n, finalized: false, cancelled: false };
function fixture() {
  const client = {
    getChainId: vi.fn().mockResolvedValue(43113), getBlock: vi.fn().mockResolvedValue({ timestamp: 87400n }),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "getRounds") return [round];
      if (functionName === "FINALIZE_GRACE") return state.grace;
      if (functionName === "isCancelled") return state.cancelled;
      return state[functionName as "endTime" | "finalized"];
    }),
    simulateContract: vi.fn().mockResolvedValue({ request: { address: round, functionName: "finalize", account } }),
    estimateContractGas: vi.fn().mockResolvedValue(1_000_000n),
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n),
    getBalance: vi.fn().mockResolvedValue(10n ** 18n),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
  };
  const walletClient = { writeContract: vi.fn().mockResolvedValue(`0x${"a".repeat(64)}`) };
  return { client, walletClient, account, factory, send: true, log: vi.fn() };
}

describe("Fuji finalize keeper", () => {
  it("waits the full 24 hours even when the keeper could be the admin", () => {
    expect(canAutoFinalize(state, 87399n)).toBe(false);
    expect(canAutoFinalize(state, 87400n)).toBe(true);
    expect(canAutoFinalize({ ...state, cancelled: true }, 99999n)).toBe(false);
    expect(canAutoFinalize({ ...state, finalized: true }, 99999n)).toBe(false);
    expect(canAutoFinalize({ ...state, grace: 0n }, 99999n)).toBe(false);
  });
  it("defaults to dry-run without signing or spending gas", async () => {
    const options = fixture();
    const result = await finalizeEligibleRounds({ ...options, send: false });
    expect(result.eligible).toBe(1);
    expect(options.walletClient.writeContract).not.toHaveBeenCalled();
    expect(options.client.simulateContract).not.toHaveBeenCalled();
  });
  it("simulates and confirms one eligible transaction with a gas buffer", async () => {
    const options = fixture();
    const result = await finalizeEligibleRounds(options);
    expect(result.finalized).toBe(1);
    expect(options.client.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ address: round, functionName: "finalize", account }));
    expect(options.walletClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ gas: 1_200_000n, gasPrice: 1_000_000_000n }));
  });
  it("rejects an RPC on the wrong network before reading rounds", async () => {
    const options = fixture();
    options.client.getChainId.mockResolvedValue(43114);
    await expect(finalizeEligibleRounds(options)).rejects.toThrow("RPC_CHAIN_MISMATCH");
    expect(options.client.readContract).not.toHaveBeenCalled();
  });
  it("skips finalized or cancelled rounds without sending", async () => {
    for (const getter of ["finalized", "isCancelled"]) {
      const options = fixture();
      const original = options.client.readContract.getMockImplementation()!;
      options.client.readContract.mockImplementation(call => call.functionName === getter ? Promise.resolve(true) : original(call));
      expect((await finalizeEligibleRounds(options)).skipped).toBe(1);
      expect(options.walletClient.writeContract).not.toHaveBeenCalled();
    }
  });
  it("fails closed on unreadable cancellation and continues with another round", async () => {
    const options = fixture();
    const original = options.client.readContract.getMockImplementation()!;
    options.client.readContract.mockImplementation(call => {
      if (call.functionName === "getRounds") return Promise.resolve([round, other]);
      if ((call as { address?: string }).address === round && call.functionName === "isCancelled") return Promise.reject(new Error("RPC"));
      return original(call);
    });
    const result = await finalizeEligibleRounds(options);
    expect(result.failed).toBe(1);
    expect(result.finalized).toBe(1);
    expect(options.walletClient.writeContract).toHaveBeenCalledTimes(1);
  });
  it("stops when the wallet has a pending transaction, including after restart", async () => {
    const options = fixture();
    options.client.getTransactionCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect((await finalizeEligibleRounds(options)).failed).toBe(1);
    expect(options.walletClient.writeContract).not.toHaveBeenCalled();
  });
  it("stops the scan if a submitted transaction has an unknown receipt", async () => {
    const options = fixture();
    const original = options.client.readContract.getMockImplementation()!;
    options.client.readContract.mockImplementation(call => call.functionName === "getRounds" ? Promise.resolve([round, other]) : original(call));
    options.client.waitForTransactionReceipt.mockRejectedValue(new Error("timeout"));
    expect((await finalizeEligibleRounds(options)).failed).toBe(1);
    expect(options.walletClient.writeContract).toHaveBeenCalledTimes(1);
  });
  it("does not send if simulation fails because the organizer already finalized", async () => {
    const options = fixture();
    options.client.simulateContract.mockRejectedValue(new Error("AlreadyFinalized"));
    expect((await finalizeEligibleRounds(options)).failed).toBe(1);
    expect(options.walletClient.writeContract).not.toHaveBeenCalled();
  });
  it("enforces fee, gas and wallet balance limits", async () => {
    const highFee = fixture();
    highFee.client.getGasPrice.mockResolvedValue(101_000_000_000n);
    const highGas = fixture();
    highGas.client.estimateContractGas.mockResolvedValue(3_000_000n);
    const noBalance = fixture();
    noBalance.client.getBalance.mockResolvedValue(0n);
    for (const options of [highFee, highGas, noBalance]) {
      expect((await finalizeEligibleRounds(options)).failed).toBe(1);
      expect(options.walletClient.writeContract).not.toHaveBeenCalled();
    }
  });
});

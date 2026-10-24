import { afterEach, expect, it, vi } from "vitest";
import { runTxAction, ConfirmationReadError } from "@/lib/txAction";
import { roundsStore } from "@/lib/store/roundsStore";
const hash = `0x${"a".repeat(64)}` as const, address = `0x${"1".repeat(40)}` as const;
const receipt = { status: "success" as const, transactionHash: hash, gasUsed: 21_000n, effectiveGasPrice: 25_000_000_000n };
afterEach(() => roundsStore.getState().reset());
it("waits for mining, publishes before confirmation reads, then reports the actual fee", async () => {
  const order: string[] = [];
  const success = vi.fn();
  await runTxAction({ send: async () => { order.push("send"); return hash; }, waitForReceipt: async () => { order.push("receipt"); return receipt; },
    patch: () => { order.push("patch"); return [roundsStore.getState().upsert({ id: address, address, name: "New" }, true)]; },
    confirm: async () => { order.push("confirm"); expect(roundsStore.getState().rounds[0].name).toBe("New"); }, onSuccess: success });
  expect(order).toEqual(["send", "receipt", "patch", "confirm"]);
  expect(success).toHaveBeenCalledWith({ hash, feeWei: receipt.gasUsed * receipt.effectiveGasPrice });
});
it("never patches a rejected wallet request or reverted receipt", async () => {
  const patch = vi.fn(() => []), confirm = vi.fn(async () => {});
  await expect(runTxAction({ send: async () => { throw new Error("User rejected"); }, waitForReceipt: async () => receipt, patch, confirm })).rejects.toThrow("User rejected");
  await expect(runTxAction({ send: async () => hash, waitForReceipt: async () => ({ ...receipt, status: "reverted" }), patch, confirm })).rejects.toThrow("reverted");
  expect(patch).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});
it("rolls back the entire batch on confirmation RPC failure and distinguishes this from a reverted transaction", async () => {
  const s = roundsStore.getState; s().upsert({ id: address, address, name: "Old" }); const success = vi.fn();
  await expect(runTxAction({ send: async () => hash, waitForReceipt: async () => receipt,
    patch: () => [s().patch(address, { name: "New" }, true), s().patch(address, { admin: address }, true)],
    confirm: async () => { throw new Error("RPC offline"); }, onSuccess: success })).rejects.toBeInstanceOf(ConfirmationReadError);
  expect(s().rounds[0]).toMatchObject({ name: "Old" }); expect(s().rounds[0].admin).toBeUndefined(); expect(success).not.toHaveBeenCalled();
});

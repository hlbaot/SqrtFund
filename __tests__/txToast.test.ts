import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionFlow, TransactionTimeoutError, cancelTransactionFlows, txToast } from "../src/lib/txToast";
import { isUserRejected } from "../src/lib/errors";

beforeEach(() => { vi.useFakeTimers(); txToast.dismiss(); });
afterEach(() => { cancelTransactionFlows(); txToast.dismiss(); vi.useRealTimers(); });

describe("transaction lifecycle", () => {
  it("updates one persistent pending toast and starts expiry only on success", () => {
    txToast.pending("register", "Signing");
    vi.advanceTimersByTime(150_000);
    txToast.pending("register", "Confirming");
    expect(txToast.getToasts()).toHaveLength(1);
    txToast.success("register", "Done");
    vi.advanceTimersByTime(2999);
    expect(txToast.getToasts()[0].type).toBe("success");
    vi.advanceTimersByTime(1);
    expect(txToast.getToasts()).toEqual([]);
  });
  it("recognizes nested rejection codes and expires the error after two seconds", () => {
    const flow = new TransactionFlow();
    flow.toast.pending("approve", "Signing");
    flow.error("approve", { cause: { code: 4001 } });
    expect(txToast.getToasts()[0]).toMatchObject({ id: "approve", type: "error", title: "Transaction rejected" });
    vi.advanceTimersByTime(2000);
    expect(txToast.getToasts()).toEqual([]);
    expect(isUserRejected({ cause: { code: "ACTION_REJECTED" } })).toBe(true);
    const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
    expect(isUserRejected(cyclic)).toBe(false);
  });
  it("cancels an outstanding signature and suppresses late updates and the next step", async () => {
    const flow = new TransactionFlow();
    let complete!: (value: string) => void;
    const signature = new Promise<string>(resolve => { complete = resolve; });
    flow.toast.pending("approve", "Signing");
    const result = flow.wait(() => signature);
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    cancelTransactionFlows();
    complete("0xhash");
    await rejected;
    flow.toast.success("approve", "Late success");
    const nextStep = vi.fn(async () => "donation");
    await expect(flow.wait(nextStep)).rejects.toMatchObject({ name: "AbortError" });
    expect(nextStep).not.toHaveBeenCalled();
    expect(txToast.getToasts()).toEqual([]);
  });
  it("times out receipt waiting, clears other pending steps, and expires the error", async () => {
    const flow = new TransactionFlow();
    flow.toast.pending("approve", "Approving");
    flow.toast.pending("donate", "Confirming");
    const receipt = flow.wait(() => new Promise(() => {}), 120_000);
    const rejection = expect(receipt).rejects.toBeInstanceOf(TransactionTimeoutError);
    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
    flow.error("donate", new TransactionTimeoutError());
    expect(txToast.getToasts()).toEqual([expect.objectContaining({ id: "donate", type: "error", title: "Transaction timeout" })]);
    vi.advanceTimersByTime(2000);
    expect(txToast.getToasts()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not reset success expiry when unrelated toasts change", () => {
    txToast.success("done", "Done");
    vi.advanceTimersByTime(2000);
    txToast.pending("other", "Signing");
    vi.advanceTimersByTime(1000);
    expect(txToast.getToasts().map(t => t.id)).toEqual(["other"]);
  });
});

import type { Hash, TransactionReceipt } from "viem";
import type { StoreChange } from "./store/mirror";

export class ConfirmationReadError extends Error {
  constructor() { super("Transaction confirmed; UI verification failed and its temporary patch was rolled back. Retry the chain read."); }
}
export async function confirmTxAction<R extends Pick<TransactionReceipt, "status" | "transactionHash" | "gasUsed" | "effectiveGasPrice">>(
  receipt: R,
  options: {
    patch: (receipt: R) => StoreChange[];
    confirm: (receipt: R, changes: StoreChange[]) => Promise<void>;
    onSuccess?: (result: { hash: Hash; feeWei: bigint }) => void;
    onConfirmationError?: () => void;
  },
) {
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  const changes = options.patch(receipt);
  try {
    await options.confirm(receipt, changes);
    changes.forEach(change => change.commit());
  } catch {
    [...changes].reverse().forEach(change => change.rollback());
    options.onConfirmationError?.();
    throw new ConfirmationReadError();
  }
  const result = { hash: receipt.transactionHash, feeWei: receipt.gasUsed * receipt.effectiveGasPrice };
  options.onSuccess?.(result);
  return result;
}
export async function runTxAction<R extends Pick<TransactionReceipt, "status" | "transactionHash" | "gasUsed" | "effectiveGasPrice">>(options: {
  send: () => Promise<Hash>;
  waitForReceipt: (hash: Hash) => Promise<R>;
} & Parameters<typeof confirmTxAction<R>>[1]) {
  const hash = await options.send();
  return confirmTxAction(await options.waitForReceipt(hash), options);
}

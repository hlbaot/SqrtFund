"use client";
import { useCallback, useEffect, useRef } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { TransactionReceipt } from "viem";
import { TransactionFlow } from "@/lib/txToast";
import { invalidateTokenBalances } from "@/lib/tokenBalance";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { confirmTxAction } from "@/lib/txAction";
import { patchReceipt, readMirrorSnapshot } from "@/lib/store/chainSync";
import type { StoreChange } from "@/lib/store/mirror";

export type TxActionOptions = { patch?: (receipt: TransactionReceipt) => StoreChange[] };
/** Hook xác nhận dùng chung: cập nhật mọi view trước lần đọc RPC đầu, chỉ dựa trên log đã xác thực. */
export function useTxAction() {
  const queryClient = useQueryClient();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { address, status, chainId: accountChainId } = useAccount();
  const configChainId = useChainId(), chainId = accountChainId ?? configChainId;
  const scopes = useRef(new Map<string, TransactionFlow>());
  useEffect(() => {
    const flows = scopes.current;
    return () => { for (const flow of flows.values()) flow.cancel(); flows.clear(); };
  }, [address, chainId, status]);
  return useCallback((scope = "default", options: TxActionOptions = {}) => {
    scopes.current.get(scope)?.cancel();
    const flow = new TransactionFlow(async rawReceipt => {
      const receipt = rawReceipt as TransactionReceipt;
      if (!client || chainId !== TARGET_CHAIN_ID || (client.chain && client.chain.id !== TARGET_CHAIN_ID)) return;
      if (!Array.isArray(receipt.logs) || receipt.blockNumber === undefined) { await invalidateTokenBalances(queryClient); return; }
      // Huỷ các lần đọc cache đang chạy để phản hồi cũ không ghi đè receipt mới
      await queryClient.cancelQueries({ predicate: q => ["readContracts", "round-fields", "ui-mirror"].includes(String(q.queryKey[0])) });
      let plan: ReturnType<typeof patchReceipt>;
      await confirmTxAction(receipt, {
        patch: () => {
          plan = patchReceipt(receipt);
          return [...plan.changes, ...(options.patch?.(receipt) ?? [])];
        },
        confirm: async (_, changes) => {
          const publish = await flow.wait(() => readMirrorSnapshot(client, plan.rounds, plan.organizers, receipt.blockNumber), 30_000);
          if (flow.cancelled) throw new Error("Flow cancelled");
          changes.forEach(change => change.commit());
          publish();
        },
        onConfirmationError: () => {
          void queryClient.invalidateQueries({ queryKey: ["ui-mirror"] });
        },
      });
      await invalidateTokenBalances(queryClient);
      void queryClient.invalidateQueries({ predicate: q => ["readContract", "readContracts", "round-fields", "round-donation-history", "round-notifications"].includes(String(q.queryKey[0])) });
    });
    scopes.current.set(scope, flow);
    return flow;
  }, [queryClient, client, chainId]);
}

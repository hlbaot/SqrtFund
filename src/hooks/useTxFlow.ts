"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import { TransactionFlow } from "@/lib/txToast";

export function useTxFlow() {
  const { address, status, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const scopes = useRef(new Map<string, TransactionFlow>());
  useEffect(() => {
    const flows = scopes.current;
    return () => {
      for (const flow of flows.values()) flow.cancel();
      flows.clear();
    };
  }, [address, chainId, status]);
  return useCallback((scope = "default") => {
    scopes.current.get(scope)?.cancel();
    const flow = new TransactionFlow();
    scopes.current.set(scope, flow);
    return flow;
  }, []);
}

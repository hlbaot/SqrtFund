"use client";
import type { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { tokenBalanceOptions } from "@/lib/tokenBalance";

/** Address is the wallet/recipient; the token always comes from addresses.ts. */
export function useTokenBalance(owner?: Address) {
  const { isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const options = tokenBalanceOptions(client, owner);
  const enabled = options.enabled && isConnected && chainId === TARGET_CHAIN_ID;
  const query = useQuery({ ...options, enabled });
  const isReady = Boolean(enabled && query.isSuccess && !query.isError && typeof query.data === "bigint");
  return {
    ...query,
    balance: isReady ? query.data : undefined,
    isReady,
    isLoading: Boolean(enabled && query.isPending),
    isError: Boolean(enabled && query.isError),
    isEnabled: Boolean(enabled),
  };
}

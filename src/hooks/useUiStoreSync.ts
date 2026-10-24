"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { refreshUiStores } from "@/lib/store/chainSync";
import { useVisiblePolling } from "./useVisiblePolling";
/** One visible-tab fallback for both current-wallet permissions and all projects.
 * Socket events invalidate this same query; API applications have their own query. */
export function useUiStoreSync() {
  const { address, chainId, isConnected } = useAccount();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const interval = useVisiblePolling();
  useQuery({ queryKey: ["ui-mirror", TARGET_CHAIN_ID, factoryAddress.toLowerCase(), address?.toLowerCase()],
    enabled: Boolean(client && factoryAddress && interval && (!isConnected || chainId === TARGET_CHAIN_ID)),
    queryFn: async () => { await refreshUiStores(client!, address); return Date.now(); },
    refetchInterval: interval, refetchIntervalInBackground: false, staleTime: 0, retry: 1,
  });
}

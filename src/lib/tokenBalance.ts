import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { isAddress, type Address, type PublicClient } from "viem";
import { mockUsdcAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID, usdcAddress, ZERO_ADDRESS } from "@/lib/contracts/addresses";

export const TOKEN_BALANCE_KEY = ["token-balance", TARGET_CHAIN_ID] as const;
export function tokenMatchesConfigured(token?: Address) {
  return Boolean(token && isAddress(usdcAddress) && usdcAddress !== ZERO_ADDRESS && token.toLowerCase() === usdcAddress.toLowerCase());
}

export function tokenBalanceOptions(client: PublicClient | undefined, owner?: Address) {
  const valid = Boolean(client && owner && isAddress(owner) && isAddress(usdcAddress) && usdcAddress !== ZERO_ADDRESS);
  return queryOptions({
    queryKey: [...TOKEN_BALANCE_KEY, usdcAddress.toLowerCase(), owner?.toLowerCase()],
    enabled: valid,
    queryFn: async () => {
      if (!valid || !client || !owner) throw new Error("Token balance is not configured");
      return client.readContract({ address: usdcAddress, abi: mockUsdcAbi, functionName: "balanceOf", args: [owner] });
    },
    refetchInterval: 15_000,
    retryOnMount: false,
  });
}

/** Refresh every mounted wallet/recipient balance after a confirmed transaction. */
export function invalidateTokenBalances(client: QueryClient) {
  return client.invalidateQueries({ queryKey: TOKEN_BALANCE_KEY });
}

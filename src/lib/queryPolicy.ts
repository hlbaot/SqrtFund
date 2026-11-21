/** Thời gian cache áp cho từng khóa chain/address/query, không dùng chéo ví khác. */
export const QUERY_STALE_MS = 15_000;
export const QUERY_GC_MS = 30 * 60_000;
export const IMMUTABLE_STALE_MS = 5 * 60_000;
export const CLIENT_MULTICALL_BATCH = { wait: 20, batchSize: 8192 } as const;
export const queryRetryDelay = (attempt: number) => Math.min(500 * 2 ** attempt, 3000);
export const defaultQueryPolicy = {
  refetchOnWindowFocus: false,
  staleTime: QUERY_STALE_MS,
  gcTime: QUERY_GC_MS,
  retry: 2,
  retryDelay: queryRetryDelay,
} as const;

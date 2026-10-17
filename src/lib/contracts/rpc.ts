import { fallback, http } from "viem";
/** These URLs are public browser configuration; never put private credentials here. */
export function createFujiTransport(primaryUrl?: string, fallbackUrl?: string) {
  const options = { batch: { wait: 20, batchSize: 10 }, retryCount: 2, retryDelay: 750, timeout: 10000 };
  const primary = http(primaryUrl?.trim() || undefined, options);
  const secondary = fallbackUrl?.trim();
  return secondary ? fallback([primary, http(secondary, options)], { retryCount: 0 }) : primary;
}

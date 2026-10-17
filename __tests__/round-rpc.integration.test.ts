import { expect, it } from "vitest";
import { createPublicClient } from "viem";
import { avalancheFuji } from "viem/chains";
import { createFujiTransport } from "@/lib/contracts/rpc";
import { loadRoundFields } from "@/lib/contracts/roundReads";
// Read-only, explicit opt-in. No .env.local, keys, SMTP or Supabase access.
it.skipIf(process.env.RUN_ROUND_RPC_INTEGRATION !== "1")("reads the actual Fuji legacy round through allowFailure multicall", async () => {
  const client = createPublicClient({ chain: avalancheFuji, transport: createFujiTransport("https://api.avax-test.network/ext/bc/C/rpc") });
  const data = await loadRoundFields(calls => client.multicall({ contracts: calls, allowFailure: true }), "0x340618b437F0314f136d5dB2228C13db61F7a7cc");
  expect(data.version).toBe("legacy"); expect(data.results.slice(0, 12).every(r => r.status === "success")).toBe(true);
  expect(data.results[11].result).toBe(1n); expect(data.results[14].status).toBe("skipped");
}, 30000);

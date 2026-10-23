import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createPublicClient, createWalletClient, http, isAddress, parseGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { finalizeEligibleRounds } from "./keeper/finalize.mjs";

// Mặc định chỉ đọc. Chỉ --send mới nạp signer; tuyệt đối không dùng key attester/admin tự động.
const config = {};
for (const file of [".env", ".env.local"]) {
  const path = new URL(`../${file}`, import.meta.url);
  if (existsSync(path)) Object.assign(config, parseEnv(readFileSync(path, "utf8")));
}
Object.assign(config, process.env);
const send = process.argv.includes("--send");
const once = process.argv.includes("--once");
if (process.argv.slice(2).some(arg => !["--send", "--once"].includes(arg))) throw new Error("Usage: pnpm keeper [--once] [--send]");
if (Number(config.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113) throw new Error("KEEPER_REQUIRES_FUJI");
const factory = config.NEXT_PUBLIC_FACTORY_ADDRESS;
if (!isAddress(factory ?? "")) throw new Error("CONFIGURE_NEXT_PUBLIC_FACTORY_ADDRESS");
const interval = Number(config.KEEPER_INTERVAL_MS || 60_000);
if (!Number.isSafeInteger(interval) || interval < 10_000 || interval > 3_600_000) throw new Error("INVALID_KEEPER_INTERVAL");
const maxGas = BigInt(config.KEEPER_MAX_GAS || "2500000");
const maxGasPrice = parseGwei(config.KEEPER_MAX_GAS_PRICE_GWEI || "100");
if (maxGas <= 0n || maxGasPrice <= 0n) throw new Error("INVALID_KEEPER_GAS_LIMIT");
const transport = () => http(config.KEEPER_RPC_URL || config.NEXT_PUBLIC_RPC_URL || avalancheFuji.rpcUrls.default.http[0], { timeout: 15_000, retryCount: 1 });
const client = createPublicClient({ chain: avalancheFuji, transport: transport() });
let account;
let walletClient;
if (send) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(config.KEEPER_PRIVATE_KEY ?? "")) throw new Error("CONFIGURE_KEEPER_PRIVATE_KEY");
  try { account = privateKeyToAccount(config.KEEPER_PRIVATE_KEY); }
  catch { throw new Error("INVALID_KEEPER_PRIVATE_KEY"); }
  walletClient = createWalletClient({ chain: avalancheFuji, account, transport: transport() });
}
console.log(`[keeper] ${send ? "SEND" : "DRY-RUN"}; Fuji; factory ${factory}${account ? `; signer ${account.address}` : ""}`);
let stopped = false;
let timer;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopped = true; clearTimeout(timer); });
async function tick() {
  try {
    const summary = await finalizeEligibleRounds({ client, walletClient, account, factory, send, maxGas, maxGasPrice });
    console.log("[keeper] summary", summary);
    if (once && summary.failed > 0) process.exitCode = 1;
  } catch {
    console.error("[keeper] scan failed; check network/configuration (credentials omitted)");
    if (once) process.exitCode = 1;
  }
  if (!once && !stopped) timer = setTimeout(tick, interval);
}
await tick();

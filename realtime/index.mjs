import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";
import { createRealtimeServer } from "./server.mjs";
import { createChainPoller } from "./chain-watcher.mjs";

const { http: server, io } = createRealtimeServer({
  secret: process.env.SOCKET_PUBLISH_SECRET,
  origins: (process.env.SOCKET_ALLOWED_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean),
});
const client = createPublicClient({ chain: avalancheFuji, transport: http(process.env.NEXT_PUBLIC_RPC_URL, { timeout: 10_000, retryCount: 1 }) });
if (Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113 || await client.getChainId() !== 43113) {
  throw new Error("Realtime worker requires Fuji (43113)");
}
const poll = createChainPoller(client, process.env.NEXT_PUBLIC_FACTORY_ADDRESS, () => io.emit("data:changed", { kind: "chain" }));
let stopped = false;
let timer;
const tick = async () => {
  try { await poll(); } catch { console.warn("[realtime] RPC unavailable; retrying without advancing cursor"); }
  if (!stopped) timer = setTimeout(tick, 5000);
};
// Khởi tạo cursor trước khi nhận browser; lần kết nối mới luôn đọc snapshot đầy đủ.
await poll();
server.listen(Number(process.env.SOCKET_PORT ?? process.env.PORT ?? 3002), () => console.log("[realtime] listening"));
void tick();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  stopped = true;
  clearTimeout(timer);
  io.close();
});

import { isAddress, parseAbi, zeroAddress } from "viem";

export const FINALIZE_GRACE_SECONDS = 86_400n;
const factoryAbi = parseAbi(["function getRounds() view returns (address[])"]);
export const roundAbi = parseAbi([
  "function endTime() view returns (uint256)",
  "function FINALIZE_GRACE() view returns (uint256)",
  "function finalized() view returns (bool)",
  "function isCancelled() view returns (bool)",
  "function finalize()",
]);

/** Chỉ chốt sau endTime + 24h, kể cả khi keeper vô tình dùng ví admin. */
export function canAutoFinalize({ endTime, grace, finalized, cancelled }, timestamp) {
  return grace === FINALIZE_GRACE_SECONDS && endTime > 0n
    && !finalized && !cancelled && timestamp >= endTime + FINALIZE_GRACE_SECONDS;
}

/** Một lần quét, gửi tuần tự. Không ghi DB, không claim hay rút tiền của Round. */
export async function finalizeEligibleRounds({ client, walletClient, account, factory, send = false,
  maxGas = 2_500_000n, maxGasPrice = 100_000_000_000n, log = console.log }) {
  if (!isAddress(factory) || factory.toLowerCase() === zeroAddress) throw new Error("INVALID_FACTORY");
  if (await client.getChainId() !== 43113) throw new Error("RPC_CHAIN_MISMATCH");
  if (send && (!account || !walletClient)) throw new Error("KEEPER_SIGNER_REQUIRED");
  const head = await client.getBlock();
  const rounds = await client.readContract({ address: factory, abi: factoryAbi, functionName: "getRounds" });
  const summary = { eligible: 0, finalized: 0, skipped: 0, failed: 0 };
  for (const address of [...new Set(rounds.map(round => round.toLowerCase()))]) {
    try {
      const read = functionName => client.readContract({ address, abi: roundAbi, functionName });
      const [endTime, grace, finalized, cancelled] = await Promise.all([
        read("endTime"), read("FINALIZE_GRACE"), read("finalized"), read("isCancelled"),
      ]);
      // Round cũ thiếu getter hoặc RPC lỗi sẽ vào catch; không giả định nó chưa hủy.
      if (!canAutoFinalize({ endTime, grace, finalized, cancelled }, head.timestamp)) {
        summary.skipped++;
        continue;
      }
      summary.eligible++;
      if (!send) { log(`[keeper] eligible ${address}; dry-run, no transaction`); continue; }

      // Pending nonce khác latest: dừng để chờ giao dịch cũ, kể cả sau restart.
      // Chỉ chạy một instance và dùng ví riêng để không tranh nonce với người dùng.
      const [latest, pending] = await Promise.all([
        client.getTransactionCount({ address: account.address, blockTag: "latest" }),
        client.getTransactionCount({ address: account.address, blockTag: "pending" }),
      ]);
      if (latest !== pending) throw new Error("KEEPER_TRANSACTION_PENDING");
      // Simulation kiểm tra trạng thái mới nhất: organizer có thể vừa chốt/hủy.
      const { request } = await client.simulateContract({ address, abi: roundAbi, functionName: "finalize", account });
      const gasPrice = await client.getGasPrice();
      if (gasPrice > maxGasPrice) throw new Error("GAS_PRICE_LIMIT");
      const estimate = await client.estimateContractGas(request);
      const gas = (estimate * 120n + 99n) / 100n;
      if (gas > maxGas) throw new Error("GAS_LIMIT");
      if (await client.getBalance({ address: account.address }) < gas * gasPrice) throw new Error("INSUFFICIENT_KEEPER_AVAX");
      const hash = await walletClient.writeContract({ ...request, gas, gasPrice });
      log(`[keeper] submitted ${address} ${hash}`);
      // Dừng cả lượt quét nếu mất receipt: không tự phát lại một giao dịch chưa rõ kết quả.
      let receipt;
      try { receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 }); }
      catch { throw new Error("KEEPER_RECEIPT_UNKNOWN"); }
      if (receipt.status !== "success") throw new Error("FINALIZE_REVERTED");
      summary.finalized++;
      log(`[keeper] finalized ${address} ${hash}`);
    } catch (error) {
      summary.failed++;
      // Không in raw error: RPC URL hoặc thông tin signer có thể nằm trong error.
      const known = ["KEEPER_TRANSACTION_PENDING", "KEEPER_RECEIPT_UNKNOWN", "GAS_PRICE_LIMIT", "GAS_LIMIT", "INSUFFICIENT_KEEPER_AVAX", "FINALIZE_REVERTED"];
      const reason = known.includes(error?.message) ? error.message : "READ_OR_SIMULATION_FAILED";
      log(`[keeper] skipped ${address}: ${reason}`);
      if (reason === "KEEPER_TRANSACTION_PENDING" || reason === "KEEPER_RECEIPT_UNKNOWN") break;
    }
  }
  return summary;
}

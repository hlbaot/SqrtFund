import { explorerAddressUrl } from "@/lib/explorer";
import type { Address, PublicClient } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";

export type DonationHistory = {
  firstBlock: bigint;
  throughBlock: bigint;
  contributions: Record<string, Record<string, bigint>>;
  totalDonated: bigint;
  donorCount: number;
  totalDonationCount: number;
  scannedBlocks?: bigint;
  totalBlocks?: bigint;
  capped?: boolean;
  explorerUrl?: string;
};

export type RefundRow = { projectId: bigint; amount: bigint; originalAmount: bigint; refunded: boolean };
export type ReadResult = { status: string; result?: unknown };

export function canCancelRound(round: { admin?: string; finalized: boolean; isCancelled: boolean; supportsPhase2: boolean }, viewer?: string) {
  return Boolean(viewer && round.admin?.toLowerCase() === viewer.toLowerCase() && round.supportsPhase2 && !round.finalized && !round.isCancelled);
}

export function matchesCancellationInput(input: string, name: string | undefined, address: string) {
  const value = input.trim();
  return Boolean((name?.trim() && value === name.trim()) || value.toLowerCase() === address.slice(-6).toLowerCase());
}

export function refundRows(ids: readonly bigint[], reads: readonly ReadResult[], original: Record<string, bigint> = {}): RefundRow[] {
  return ids.flatMap((projectId, i) => {
    const value = reads[i];
    if (value?.status !== "success" || typeof value.result !== "bigint") return [];
    const amount = value.result;
    const originalAmount = original[projectId.toString()] ?? 0n;
    return amount > 0n || originalAmount > 0n ? [{ projectId, amount, originalAmount, refunded: amount === 0n && originalAmount > 0n }] : [];
  });
}

export function refundTotal(rows: readonly RefundRow[]) {
  return rows.reduce((sum, row) => sum + row.amount, 0n);
}

export interface BlockChunk {
  from: bigint;
  to: bigint;
}

export interface ChunkingPlan {
  chunks: BlockChunk[];
  totalBlocks: bigint;
  scannedBlocks: bigint;
  capped: boolean;
  totalPossibleChunks: number;
}

/**
 * Creates block ranges of at most maxChunkSize (default 100n, matching Fuji RPC limit).
 * Enforces a strict maxRequests ceiling (default 300).
 */
export function createBlockChunks(
  startBlock: bigint,
  endBlock: bigint,
  maxChunkSize = 100n,
  maxRequests = 300
): ChunkingPlan {
  const safeChunkSize = maxChunkSize > 0n && maxChunkSize <= 100n ? maxChunkSize : 100n;
  if (startBlock > endBlock) {
    return {
      chunks: [],
      totalBlocks: 0n,
      scannedBlocks: 0n,
      capped: false,
      totalPossibleChunks: 0,
    };
  }

  const totalBlocks = endBlock - startBlock + 1n;
  const chunks: BlockChunk[] = [];
  let from = startBlock;

  while (from <= endBlock) {
    const to = from + safeChunkSize - 1n <= endBlock ? from + safeChunkSize - 1n : endBlock;
    chunks.push({ from, to });
    from = to + 1n;
  }

  const totalPossibleChunks = chunks.length;
  const capped = chunks.length > maxRequests;
  const planChunks = capped ? chunks.slice(0, maxRequests) : chunks;
  const scannedBlocks = planChunks.length > 0
    ? planChunks[planChunks.length - 1].to - planChunks[0].from + 1n
    : 0n;

  return {
    chunks: planChunks,
    totalBlocks,
    scannedBlocks,
    capped,
    totalPossibleChunks,
  };
}

/**
 * Binary search for a block by timestamp using getBlock.
 * Much faster than historical getBytecode since block headers are cached and lightweight.
 */
export async function findBlockByTimestamp(
  client: PublicClient,
  targetTimestamp: bigint,
  lowBlock: bigint,
  highBlock: bigint,
  signal?: AbortSignal
): Promise<bigint> {
  let low = lowBlock < 0n ? 0n : lowBlock;
  let high = highBlock;

  while (low < high) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const mid = (low + high) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (block.timestamp >= targetTimestamp) {
      high = mid;
    } else {
      low = mid + 1n;
    }
  }
  return low;
}

export interface LoadDonationHistoryOptions {
  startTime?: bigint;
  endTime?: bigint;
  signal?: AbortSignal;
  onProgress?: (progress: {
    scannedBlocks: bigint;
    totalBlocks: bigint;
    completedRequests: number;
    totalRequests: number;
  }) => void;
  maxRequests?: number;
  concurrency?: number;
}

export async function loadDonationHistory(
  client: PublicClient,
  address: Address,
  previousOrOptions?: DonationHistory | LoadDonationHistoryOptions,
  maybeOptions?: LoadDonationHistoryOptions
): Promise<DonationHistory> {
  const previous = previousOrOptions && "contributions" in previousOrOptions ? previousOrOptions : undefined;
  const options = previousOrOptions && !("contributions" in previousOrOptions)
    ? previousOrOptions
    : maybeOptions ?? {};

  const { signal, onProgress, maxRequests = 300, concurrency = 5 } = options;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const latestBlockNumber = await client.getBlockNumber();
  const reusable = previous && previous.throughBlock <= latestBlockNumber ? previous : undefined;
  const contributions: DonationHistory["contributions"] = Object.fromEntries(
    Object.entries(reusable?.contributions ?? {}).map(([donor, amounts]) => [donor, { ...amounts }])
  );

  let firstBlock: bigint;
  let endBlock: bigint = latestBlockNumber;

  if (reusable) {
    firstBlock = reusable.firstBlock;
  } else if (typeof client.getBlock === "function") {
    // Determine startTime from options or contract view
    let startTime = options.startTime;
    let endTime = options.endTime;

    if (startTime === undefined && typeof client.readContract === "function") {
      try {
        startTime = (await client.readContract({
          address,
          abi: qfRoundAbi,
          functionName: "startTime",
        })) as bigint;
      } catch {
        // Ignore fallback
      }
    }

    if (endTime === undefined && typeof client.readContract === "function") {
      try {
        endTime = (await client.readContract({
          address,
          abi: qfRoundAbi,
          functionName: "endTime",
        })) as bigint;
      } catch {
        // Ignore fallback
      }
    }

    const latestBlock = await client.getBlock({ blockTag: "latest" });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    if (startTime && startTime > 0n) {
      const buffer = 300n; // 5 min safety buffer
      const targetStart = startTime > buffer ? startTime - buffer : 0n;
      firstBlock = await findBlockByTimestamp(client, targetStart, 0n, latestBlock.number, signal);
    } else {
      // Conservative default if no startTime
      firstBlock = latestBlock.number > 1000n ? latestBlock.number - 1000n : 0n;
    }

    if (endTime && endTime > 0n && endTime + 300n < latestBlock.timestamp) {
      endBlock = await findBlockByTimestamp(client, endTime + 300n, firstBlock, latestBlock.number, signal);
    } else {
      endBlock = latestBlock.number;
    }
  } else if (typeof (client as unknown as { getBytecode?: unknown }).getBytecode === "function") {
    // Compatibility fallback for unit tests mocking getBytecode
    let low = 0n;
    let high = latestBlockNumber;
    while (low < high) {
      const mid = (low + high) / 2n;
      const val = await (client as unknown as { getBytecode: (args: { address: Address; blockNumber: bigint }) => Promise<string | undefined> }).getBytecode({ address, blockNumber: mid });
      if (val && val !== "0x") high = mid; else low = mid + 1n;
    }
    firstBlock = low;
  } else {
    // Fallback for mocked clients without getBlock or getBytecode
    firstBlock = latestBlockNumber > 10n ? latestBlockNumber - 10n : 0n;
  }

  const startScanningFrom = reusable ? reusable.throughBlock + 1n : firstBlock;
  if (startScanningFrom > endBlock) {
    const totalDonated = Object.values(contributions).reduce(
      (total, amounts) => total + Object.values(amounts).reduce((sum, amount) => sum + amount, 0n),
      0n
    );
    return {
      firstBlock,
      throughBlock: endBlock,
      contributions,
      totalDonated,
      donorCount: Object.keys(contributions).length,
      totalDonationCount: Object.values(contributions).reduce((sum, m) => sum + Object.keys(m).length, 0),
      scannedBlocks: 0n,
      totalBlocks: 0n,
      capped: false,
    };
  }

  const plan = createBlockChunks(startScanningFrom, endBlock, 100n, maxRequests);
  let completedRequests = 0;
  let totalDonationCount = 0;

  for (let i = 0; i < plan.chunks.length; i += concurrency) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const batch = plan.chunks.slice(i, i + concurrency);

    const results = await Promise.all(
      batch.map(chunk =>
        client.getContractEvents({
          address,
          abi: qfRoundAbi,
          eventName: "Donated",
          fromBlock: chunk.from,
          toBlock: chunk.to,
          strict: true,
        })
      )
    );

    for (const logs of results) {
      for (const log of logs) {
        const { donor, projectId, amount } = log.args;
        if (!donor || projectId === undefined || amount === undefined) continue;
        const key = donor.toLowerCase();
        const id = projectId.toString();
        contributions[key] ??= {};
        contributions[key][id] = (contributions[key][id] ?? 0n) + amount;
        totalDonationCount++;
      }
    }

    completedRequests += batch.length;
    const currentScanned = batch[batch.length - 1].to - plan.chunks[0].from + 1n;
    onProgress?.({
      scannedBlocks: currentScanned,
      totalBlocks: plan.totalBlocks,
      completedRequests,
      totalRequests: plan.chunks.length,
    });
  }

  const lastScannedBlock = plan.chunks.length > 0 ? plan.chunks[plan.chunks.length - 1].to : endBlock;
  const totalDonated = Object.values(contributions).reduce(
    (total, amounts) => total + Object.values(amounts).reduce((sum, amount) => sum + amount, 0n),
    0n
  );

  const explorerUrl = explorerAddressUrl(address);

  return {
    firstBlock,
    throughBlock: lastScannedBlock,
    contributions,
    totalDonated,
    donorCount: Object.keys(contributions).length,
    totalDonationCount,
    scannedBlocks: plan.scannedBlocks,
    totalBlocks: plan.totalBlocks,
    capped: plan.capped,
    explorerUrl,
  };
}

export const SCALE = 1_000_000_000_000n; // 1e12

/// @notice BigInt integer square root matching OpenZeppelin Math.sqrt (floor)
export function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new Error("negative number");
  if (n === 0n) return 0n;
  let x0 = n / 2n;
  if (x0 !== 0n) {
    let x1 = (x0 + n / x0) / 2n;
    while (x1 < x0) {
      x0 = x1;
      x1 = (x0 + n / x0) / 2n;
    }
    return x0;
  }
  return 1n;
}

export type ProjectMathInput = {
  id: string | number;
  sumSqrt: bigint;
  totalDonated: bigint;
};

export type ProjectMathResult = {
  id: string | number;
  raw: bigint;
  payout: bigint;
};

export function computeRawMatching(sumSqrt: bigint, totalDonated: bigint): bigint {
  const sSquaredScaled = (sumSqrt * sumSqrt) / SCALE;
  if (sSquaredScaled > totalDonated) {
    return sSquaredScaled - totalDonated;
  }
  return 0n;
}

export function computeMatchingBigInt(
  projects: ProjectMathInput[],
  pool: bigint,
  maxMatchBps: bigint = 3000n, // Default 30%
): ProjectMathResult[] {
  const n = projects.length;
  if (n === 0) {
    return projects.map((p) => ({ id: p.id, raw: 0n, payout: 0n }));
  }

  const raws: bigint[] = projects.map((p) => computeRawMatching(p.sumSqrt, p.totalDonated));
  const sumRaw = raws.reduce((acc, r) => acc + r, 0n);
  const cap = (pool * maxMatchBps) / 10000n;

  return projects.map((p, i) => {
    const raw = raws[i];
    let payout = 0n;

    if (sumRaw === 0n) {
      payout = 0n;
    } else if (sumRaw > pool) {
      payout = (pool * raw) / sumRaw;
    } else {
      payout = raw;
    }

    if (payout > cap) {
      payout = cap;
    }

    return {
      id: p.id,
      raw,
      payout,
    };
  });
}

/// @notice Simulates the change in matching payout when a donor contributes `amount` (in 6-decimal USDC)
export function simulateDonationImpact({
  projectId,
  currentSumSqrt,
  currentTotalDonated,
  donorCurrentTotal,
  donationAmount,
  allProjects,
  pool,
  maxMatchBps,
}: {
  projectId: string | number;
  currentSumSqrt: bigint;
  currentTotalDonated: bigint;
  donorCurrentTotal: bigint;
  donationAmount: bigint;
  allProjects: ProjectMathInput[];
  pool: bigint;
  maxMatchBps: bigint;
}): {
  currentPayout: bigint;
  newPayout: bigint;
  deltaPayout: bigint;
  totalRaw: bigint;
} {
  const currentResults = computeMatchingBigInt(allProjects, pool, maxMatchBps);
  const currentItem = currentResults.find((p) => String(p.id) === String(projectId));
  const currentPayout = currentItem?.payout ?? 0n;

  // Simulate update to project sumSqrt
  const oldDonorSqrt = donorCurrentTotal > 0n ? sqrtBigInt(donorCurrentTotal * SCALE) : 0n;
  const newDonorTotal = donorCurrentTotal + donationAmount;
  const newDonorSqrt = sqrtBigInt(newDonorTotal * SCALE);

  const updatedSumSqrt = currentSumSqrt + newDonorSqrt - oldDonorSqrt;
  const updatedTotalDonated = currentTotalDonated + donationAmount;

  const projectExists = allProjects.some((p) => String(p.id) === String(projectId));
  const simulatedProjects = projectExists
    ? allProjects.map((p) => {
        if (String(p.id) === String(projectId)) {
          return {
            ...p,
            sumSqrt: updatedSumSqrt,
            totalDonated: updatedTotalDonated,
          };
        }
        return p;
      })
    : [
        ...allProjects,
        {
          id: projectId,
          sumSqrt: updatedSumSqrt,
          totalDonated: updatedTotalDonated,
        },
      ];

  const newResults = computeMatchingBigInt(simulatedProjects, pool, maxMatchBps);
  const newItem = newResults.find((p) => String(p.id) === String(projectId));
  const newPayout = newItem?.payout ?? 0n;
  const deltaPayout = newPayout > currentPayout ? newPayout - currentPayout : 0n;

  return {
    currentPayout,
    newPayout,
    deltaPayout,
    totalRaw: newResults.reduce((sum, project) => sum + project.raw, 0n),
  };
}

/** Apply all allocations before recomputing the shared pool's matching distribution. */
export function simulateDonationBatch(projects: ProjectMathInput[], donorTotals: Record<string, bigint>, allocations: { id: string; amount: bigint }[], pool: bigint, maxMatchBps: bigint) {
  const next = projects.map(project => ({ ...project }));
  const totals = { ...donorTotals };
  for (const { id, amount } of allocations) {
    if (amount < 0n) throw new Error("Negative allocation");
    const project = next.find(p => String(p.id) === id);
    if (!project) throw new Error("Unknown project");
    const old = totals[id] ?? 0n;
    project.sumSqrt += sqrtBigInt((old + amount) * SCALE) - sqrtBigInt(old * SCALE);
    project.totalDonated += amount;
    totals[id] = old + amount;
  }
  return computeMatchingBigInt(next, pool, maxMatchBps);
}

/** Percent of raw matching demand covered by the pool, floored to 2 decimals. */
export function matchingCoverage(totalRaw: bigint, pool: bigint) {
  if (totalRaw < 0n || pool < 0n) throw new Error("Negative matching inputs");
  const underfunded = totalRaw > pool;
  const bps = totalRaw === 0n || !underfunded ? 10000n : pool * 10000n / totalRaw;
  return { underfunded, percent: `${bps / 100n}.${(bps % 100n).toString().padStart(2, "0")}` };
}

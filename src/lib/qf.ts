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
  if (n === 0 || pool === 0n) {
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
  currentSumSqrt,
  currentTotalDonated,
  donorCurrentTotal,
  donationAmount,
  allProjects,
  pool,
  maxMatchBps = 3000n,
}: {
  currentSumSqrt: bigint;
  currentTotalDonated: bigint;
  donorCurrentTotal: bigint;
  donationAmount: bigint;
  allProjects: ProjectMathInput[];
  pool: bigint;
  maxMatchBps?: bigint;
}): {
  currentPayout: bigint;
  newPayout: bigint;
  deltaPayout: bigint;
} {
  const currentResults = computeMatchingBigInt(allProjects, pool, maxMatchBps);
  const currentPayout = currentResults[0]?.payout ?? 0n;

  // Simulate update to project sumSqrt
  const oldDonorSqrt = donorCurrentTotal > 0n ? sqrtBigInt(donorCurrentTotal * SCALE) : 0n;
  const newDonorTotal = donorCurrentTotal + donationAmount;
  const newDonorSqrt = sqrtBigInt(newDonorTotal * SCALE);

  const updatedSumSqrt = currentSumSqrt + newDonorSqrt - oldDonorSqrt;
  const updatedTotalDonated = currentTotalDonated + donationAmount;

  const simulatedProjects = allProjects.map((p, idx) => {
    if (idx === 0) {
      return {
        ...p,
        sumSqrt: updatedSumSqrt,
        totalDonated: updatedTotalDonated,
      };
    }
    return p;
  });

  const newResults = computeMatchingBigInt(simulatedProjects, pool, maxMatchBps);
  const newPayout = newResults[0]?.payout ?? 0n;
  const deltaPayout = newPayout > currentPayout ? newPayout - currentPayout : 0n;

  return {
    currentPayout,
    newPayout,
    deltaPayout,
  };
}

// Backward-compatible wrapper for number-based views / tests if needed
export function computeMatching(
  projects: { id: string; donations: Record<string, number> }[],
  poolNumber: number,
): { id: string; raw: number; matching: number; totalDonated: number }[] {
  const DECIMALS = 1_000_000n; // 10^6
  const poolBigInt = BigInt(Math.round(poolNumber)) * DECIMALS;

  const projectInputs: ProjectMathInput[] = projects.map((p) => {
    let sumSqrt = 0n;
    let totalDonated = 0n;

    for (const d of Object.values(p.donations)) {
      if (d > 0) {
        const dBigInt = BigInt(Math.round(d)) * DECIMALS;
        sumSqrt += sqrtBigInt(dBigInt * SCALE);
        totalDonated += dBigInt;
      }
    }

    return {
      id: p.id,
      sumSqrt,
      totalDonated,
    };
  });

  const results = computeMatchingBigInt(projectInputs, poolBigInt, 10000n);

  return results.map((r, i) => {
    const totalDonated = Number(projectInputs[i].totalDonated) / 1_000_000;
    return {
      id: String(r.id),
      raw: Number(r.raw) / 1_000_000,
      matching: Number(r.payout) / 1_000_000,
      totalDonated,
    };
  });
}

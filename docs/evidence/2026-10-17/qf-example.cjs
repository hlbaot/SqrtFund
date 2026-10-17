// Compile src/lib/qf.ts into /tmp/sqrt-evaluation/qf before running (see EVALUATION.md).
const q = require('/tmp/sqrt-evaluation/qf/qf.js');
const inputs = [[100, 1n], [20, 5n]].map(([n, amount], id) => ({
  id, sumSqrt: BigInt(n) * q.sqrtBigInt(amount * 1000000n * q.SCALE),
  totalDonated: BigInt(n) * amount * 1000000n,
}));
const output = {
  unit: 'MockUSDC base units (1 token = 1000000)',
  raw: inputs.map(p => q.computeRawMatching(p.sumSqrt, p.totalDonated)),
  pool10000_cap10000: q.computeMatchingBigInt(inputs, 10000n * 1000000n, 10000n).map(p => p.payout),
  pool10000_cap3000: q.computeMatchingBigInt(inputs, 10000n * 1000000n, 3000n).map(p => p.payout),
};
console.log(JSON.stringify(output, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));

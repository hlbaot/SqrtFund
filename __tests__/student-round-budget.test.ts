import { expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData } from "viem";
import { parseStudentRoundBudget } from "@/lib/donationPolicy";
import { donationLimit, remainingBudget } from "@/lib/studentAccess";
import { roundFactoryAbi } from "@/lib/contracts/abis";

it("uses one shared 10-USDC budget across three other projects", () => {
  const budget = parseStudentRoundBudget("10")!;
  let spent = 0n;
  for (const amount of [5_000_000n, 5_000_000n]) {
    expect(donationLimit(amount, 1n, budget, 0n, remainingBudget(budget, spent))).toBeNull();
    spent += amount;
  }
  expect(remainingBudget(budget, spent)).toBe(0n);
  expect(donationLimit(1n, 1n, budget, 0n, remainingBudget(budget, spent))).toBe("round");
  spent = 0n;
  for (const amount of [3_000_000n, 3_000_000n, 4_000_000n]) {
    expect(donationLimit(amount, 1n, budget, 0n, remainingBudget(budget, spent))).toBeNull();
    spent += amount;
  }
  expect(spent).toBe(budget);
});

it("encodes the finite student budget in the existing factory ABI without a stricter per-project cap", () => {
  const budget = parseStudentRoundBudget("25.000001")!;
  const data = encodeFunctionData({ abi: roundFactoryAbi, functionName: "createFundedRound", args: [
    "Student Round", "Club", `0x${"1".repeat(40)}`, 100n, 200n, 1n, budget, 3000n, budget, 1_000_000_000n,
  ] });
  const decoded = decodeFunctionData({ abi: roundFactoryAbi, data });
  expect(decoded.args?.slice(5, 9)).toEqual([1n, 25_000_001n, 3000n, 25_000_001n]);
});

it.each(["", "0", "-1", "1e2", "0.0000001", "abc", "9".repeat(80)])("rejects invalid student budget %s", value => {
  expect(parseStudentRoundBudget(value)).toBeUndefined();
});
it("accepts the smallest representable USDC budget", () => {
  expect(parseStudentRoundBudget("0.000001")).toBe(1n);
});

import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, maxUint256 } from "viem";
import { OPEN_DONATION_POLICY, isUncappedDonation } from "@/lib/donationPolicy";
import { donationLimit } from "@/lib/studentAccess";
import { parseUsdc } from "@/lib/format";
import { roundFactoryAbi } from "@/lib/contracts/abis";

describe("open contributions for new rounds", () => {
  const policy = OPEN_DONATION_POLICY;
  it("accepts the smallest positive USDC amount and contributions above the old caps", () => {
    for (const amount of [1n, 500_001n, 100_000_000n, 1_000_000_000n]) {
      expect(donationLimit(amount, policy.minDonation, policy.maxDonation, 20_000_000n, policy.maxPerRound - 100_000_000n)).toBeNull();
    }
    expect(parseUsdc("0.000001")).toMatchObject({ success: true, amount: 1n });
    expect(parseUsdc("0").success).toBe(false);
    expect(parseUsdc("-1").success).toBe(false);
    expect(parseUsdc("0.0000001").success).toBe(false);
    expect(donationLimit(0n, policy.minDonation, policy.maxDonation, 0n, policy.maxPerRound)).toBe("minimum");
  });
  it("encodes no-cap values in the existing deployed Factory ABI", () => {
    const data = encodeFunctionData({ abi: roundFactoryAbi, functionName: "createFundedRound", args: [
      "Round", "Organizer", "0x1111111111111111111111111111111111111111", 100n, 200n,
      policy.minDonation, policy.maxDonation, 3000n, policy.maxPerRound, 200_000_000n,
    ] });
    const decoded = decodeFunctionData({ abi: roundFactoryAbi, data });
    expect(decoded.functionName).toBe("createFundedRound");
    expect(decoded.args?.slice(5)).toEqual([1n, maxUint256, 3000n, maxUint256, 200_000_000n]);
  });
  it("keeps immutable restrictions on old rounds instead of claiming to bypass them", () => {
    expect(isUncappedDonation(5_000_000n)).toBe(false);
    expect(isUncappedDonation(undefined)).toBe(false);
    expect(donationLimit(6_000_000n, 1_000_000n, 5_000_000n, 0n, 10_000_000n)).toBe("project");
  });
});

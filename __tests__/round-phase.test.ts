import { describe, expect, it } from "vitest";
import { deriveRoundActions, deriveRoundPhase, FINALIZE_GRACE } from "@/lib/roundPhase";
import { calculateRoundSettlement } from "@/lib/roundStats";

const admin = "0xAbC", visitor = "0xdef";
const round = { roundAddress: "0xround", admin, startTime: 1000n, endTime: 2000n, finalized: false, isCancelled: false,
  supportsPhase2: true, leftover: 100n, leftoverWithdrawn: false, cancelledPoolWithdrawn: false };

describe("deriveRoundPhase", () => {
  it.each([
    [999, "notStarted"], [1000, "open"], [1999, "open"], [2000, "endedGrace"],
    [88399, "endedGrace"], [88400, "endedOpenToAll"], [88401, "endedOpenToAll"],
  ] as const)("at %s returns %s", (now, phase) => expect(deriveRoundPhase(round, now)).toBe(phase));
  it("uses exactly the contract's one-day grace interval", () => expect(FINALIZE_GRACE).toBe(86400n));
  it("prioritizes terminal states over timestamps and cancellation over finalization", () => {
    expect(deriveRoundPhase({ ...round, finalized: true }, 0)).toBe("finalized");
    expect(deriveRoundPhase({ ...round, finalized: true, isCancelled: true }, 0)).toBe("cancelled");
  });
  it("safely infers legacy phases without inventing a finalization deadline", () => {
    expect(deriveRoundPhase({}, 5000)).toBe("notStarted");
    expect(deriveRoundPhase({ endTime: 2000n }, 1000)).toBe("open");
    expect(deriveRoundPhase({ endTime: 2000n }, 2000)).toBe("endedGrace");
    expect(deriveRoundPhase({ startTime: 1000n }, 5000)).toBe("open");
    expect(deriveRoundPhase({ startTime: 1000n }, 999)).toBe("notStarted");
    expect(deriveRoundPhase({ startTime: NaN, endTime: Infinity }, NaN)).toBe("notStarted");
  });
});

describe("available round actions", () => {
  it.each([999, 1000, 1999])("only offers deposit and cancellation before the end: %s", now => {
    expect(deriveRoundActions(round, now, admin)).toMatchObject({ finalize: false, deposit: true, cancel: true, withdrawLeftover: false, withdrawPool: false });
    expect(deriveRoundActions(round, now, visitor)).toMatchObject({ finalize: false, deposit: false, cancel: false });
  });
  it("only permits the actual round admin to finalize during grace, ignoring address case", () => {
    expect(deriveRoundActions(round, 2000, admin.toLowerCase()).finalize).toBe(true);
    expect(deriveRoundActions(round, 88399, visitor).finalize).toBe(false);
  });
  it("permits connected visitors exactly when grace ends without granting admin actions", () => {
    expect(deriveRoundActions(round, 88400, visitor)).toMatchObject({ finalize: true, deposit: false, cancel: false, withdrawLeftover: false, withdrawPool: false });
    expect(deriveRoundActions(round, 88400, admin)).toMatchObject({ finalize: true, deposit: true, cancel: true });
    expect(deriveRoundActions(round, 88400).finalize).toBe(false);
  });
  it("only offers eligible leftover recovery after finalization", () => {
    const final = { ...round, finalized: true };
    expect(deriveRoundActions(final, 88400, admin)).toMatchObject({ finalize: false, deposit: false, cancel: false, withdrawLeftover: true, withdrawPool: false });
    expect(deriveRoundActions(final, 88400, visitor).withdrawLeftover).toBe(false);
    expect(deriveRoundActions({ ...final, leftoverWithdrawn: true }, 88400, admin).withdrawLeftover).toBe(false);
    expect(deriveRoundActions({ ...final, leftover: 0n }, 88400, admin).withdrawLeftover).toBe(false);
    expect(deriveRoundActions({ ...final, leftoverWithdrawn: undefined }, 88400, admin).withdrawLeftover).toBe(false);
  });
  it("only offers admin pool recovery after cancellation, once", () => {
    const cancelled = { ...round, isCancelled: true };
    expect(deriveRoundActions(cancelled, 88400, admin)).toMatchObject({ finalize: false, deposit: false, cancel: false, withdrawLeftover: false, withdrawPool: true });
    expect(deriveRoundActions(cancelled, 88400, visitor).withdrawPool).toBe(false);
    expect(deriveRoundActions({ ...cancelled, cancelledPoolWithdrawn: true }, 88400, admin).withdrawPool).toBe(false);
  });
  it("hides unsupported, unreadable and legacy actions without guessing missing timestamps", () => {
    expect(deriveRoundActions({ ...round, supportsPhase2: false }, 1000, admin).cancel).toBe(false);
    expect(deriveRoundActions({ ...round, depositSupported: false }, 1000, admin).deposit).toBe(false);
    expect(deriveRoundActions({ ...round, endTime: undefined }, 88400, admin).finalize).toBe(false);
    expect(deriveRoundActions({ ...round, startTime: 3000n }, 88400, admin).finalize).toBe(false);
    for (const unavailable of [{ isError: true }, { isLoading: true }, { roundAddress: undefined }]) {
      expect(deriveRoundActions({ ...round, ...unavailable }, 88400, admin)).toMatchObject({ finalize: false, deposit: false, cancel: false });
    }
  });
});

describe("round finalization financial summary", () => {
  const projects = [{ approved: true, sumSqrtRaw: 2_000_000_000n, totalDonatedRaw: 2_000_000n, claimed: false }];
  it("applies caps to the proposed matching and leftover while coverage uses raw demand", () => {
    expect(calculateRoundSettlement(projects, 1_000_000n, 3000n)).toMatchObject({
      totalDonatedRaw: 2_000_000n, totalRaw: 2_000_000n, matching: 300_000n, leftover: 700_000n,
      matchingCount: 1, allClaimed: false, coverage: { percent: "50.00", underfunded: true },
    });
  });
  it("uses recorded finalized leftover for allocated matching and retains unclaimed actions", () => {
    expect(calculateRoundSettlement(projects, 1_000_000n, 3000n, 700_000n)).toMatchObject({ matching: 300_000n, leftover: 700_000n, allClaimed: false });
    expect(calculateRoundSettlement([{ ...projects[0], claimed: true }], 1_000_000n, 3000n).allClaimed).toBe(true);
  });
  it("handles no projects and missing legacy financial fields without NaN", () => {
    expect(calculateRoundSettlement([], 1_000_000n, 3000n)).toMatchObject({ matching: 0n, leftover: 1_000_000n, matchingCount: 0 });
    expect(calculateRoundSettlement(undefined, undefined, undefined)).toMatchObject({ matching: undefined, leftover: undefined, matchingCount: undefined });
  });
});

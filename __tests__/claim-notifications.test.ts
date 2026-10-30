import { expect, it } from "vitest";
import { buildNotificationItems, countUnseenNotifications } from "@/lib/notifications";
import { CLAIM_RECOMMENDATION_SECONDS, DAY_SECONDS } from "@/lib/claimWindow";
const wallet = `0x${"1".repeat(40)}`, roundAddress = `0x${"2".repeat(40)}`;
const project = { id: "1", ownerAddress: wallet, approved: true, rejected: false, claimed: false, totalDonatedRaw: 2n, finalMatchingRaw: 3n, estimatedMatchingRaw: 0n };
const round = { roundAddress, finalized: true, isCancelled: false, finalizedAt: 1000 };
const deadline = 1000 + CLAIM_RECOMMENDATION_SECONDS;
const items = (now: number) => buildNotificationItems({ address: wallet, round, projects: [project], now });
it("creates distinct stable reminder keys at 7, 3, 1 days and after the recommendation", () => {
  const keys = new Set<string>();
  for (const [days, stage] of [[7, "7d"], [3, "3d"], [1, "1d"], [0, "overdue"]] as const) {
    const reminders = items(deadline - days * DAY_SECONDS).filter(i => i.key.startsWith("claimReminder:"));
    expect(reminders).toHaveLength(1); expect(reminders[0].key).toContain(`:${stage}:1000`); keys.add(reminders[0].key);
  }
  expect(keys.size).toBe(4);
  expect(items(deadline - 8 * DAY_SECONDS).some(i => i.key.startsWith("claimReminder:"))).toBe(false);
});
it("a new stage becomes unread after the previous stage was acknowledged", () => {
  const prior = items(deadline - 7 * DAY_SECONDS), current = items(deadline - 3 * DAY_SECONDS);
  expect(countUnseenNotifications(current, prior.map(i => i.key)).activity).toBe(1);
});
it("stops reminders after claim, cancellation, missing payout/time or for another wallet", () => {
  for (const patch of [{ project: { ...project, claimed: true }, round }, { project, round: { ...round, isCancelled: true } }, { project: { ...project, finalMatchingRaw: undefined }, round }, { project, round: { ...round, finalizedAt: undefined } }]) {
    const result = buildNotificationItems({ address: wallet, round: patch.round, projects: [patch.project], now: deadline });
    expect(result.some(i => i.key.startsWith("claimReminder:"))).toBe(false);
  }
  expect(buildNotificationItems({ address: roundAddress, round, projects: [project], now: deadline })).toEqual([]);
});

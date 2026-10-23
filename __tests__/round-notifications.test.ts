import { describe, expect, it, vi } from "vitest";
import { loadRoundNotificationSnapshot, roundProjectNotificationItems } from "@/lib/roundNotifications";

const round = `0x${"1".repeat(40)}` as const;
const admin = `0x${"2".repeat(40)}` as const;
const owner = `0x${"3".repeat(40)}` as const;
const projects = Array.from({ length: 51 }, (_, index) => ({ id: BigInt(index + 1), name: `Project ${index + 1}`, owner,
  approved: index === 0, rejected: index === 1 }));
const read = () => vi.fn(async (call: { functionName: string; args?: readonly unknown[] }) => {
  if (call.functionName === "admin") return admin;
  if (call.functionName === "endTime") return 1000n;
  if (call.functionName === "getProjects") { const offset = Number(call.args?.[0]); return [projects.slice(offset, offset + 50), 51n]; }
  return false;
});
describe("notification snapshots across rounds", () => {
  it("reads beyond the first 50 projects and scopes notices to the correct wallet", async () => {
    const reader = read();
    const snapshot = await loadRoundNotificationSnapshot(reader, round);
    expect(snapshot.projects).toHaveLength(51);
    const pending = roundProjectNotificationItems(snapshot, admin, 500);
    expect(pending).toHaveLength(49);
    expect(pending.at(-1)?.key).toBe(`projectPending:${round}:51`);
    const decisions = roundProjectNotificationItems(snapshot, owner, 500);
    expect(decisions.map(item => item.key)).toEqual([`projectApproved:${round}:1`, `projectRejected:${round}:2`]);
    expect(roundProjectNotificationItems(snapshot, `0x${"4".repeat(40)}`, 500)).toEqual([]);
    expect(roundProjectNotificationItems(snapshot, admin, 1000)).toEqual([]);
  });
  it("does not convert RPC errors into empty or approved snapshots", async () => {
    await expect(loadRoundNotificationSnapshot(vi.fn().mockRejectedValue(new Error("RPC down")), round)).rejects.toThrow("RPC down");
  });
});

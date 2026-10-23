import { describe, expect, it, vi } from "vitest";
import { createChainPoller } from "../realtime/chain-watcher.mjs";
import { isNotificationQuery, isRealtimeChange } from "@/lib/realtime";

const factory = `0x${"1".repeat(40)}`;
const round = `0x${"2".repeat(40)}`;

describe("realtime refresh", () => {
  it("accepts only refresh hints, never treats payload as authority", () => {
    expect(isRealtimeChange({ kind: "chain" })).toBe(true);
    expect(isRealtimeChange({ kind: "organizers" })).toBe(true);
    expect(isRealtimeChange({ role: "platform_owner" })).toBe(false);
    expect(isRealtimeChange(null)).toBe(false);
    expect(isNotificationQuery(["organizer-application", "wallet"])).toBe(true);
    expect(isNotificationQuery(["round-notifications", 43113, factory, round])).toBe(true);
    expect(isNotificationQuery(["unrelated"])).toBe(false);
  });

  it("scans all known rounds with at most 100 blocks per request", async () => {
    const client = { getBlockNumber: vi.fn().mockResolvedValueOnce(100n).mockResolvedValue(350n),
      readContract: vi.fn().mockResolvedValue([round]), getLogs: vi.fn().mockResolvedValue([{ removed: false }]) };
    const changed = vi.fn();
    const poll = createChainPoller(client, factory, changed);
    await poll();
    expect(changed).not.toHaveBeenCalled();
    await poll();
    expect(client.getLogs.mock.calls.map(([call]) => [call.fromBlock, call.toBlock])).toEqual([[101n, 200n], [201n, 300n], [301n, 350n]]);
    expect(client.getLogs.mock.calls[0][0].address).toEqual([factory, round]);
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it("does not lose the cursor after an RPC failure", async () => {
    const client = { getBlockNumber: vi.fn().mockResolvedValueOnce(100n).mockResolvedValue(110n),
      readContract: vi.fn().mockResolvedValue([round]), getLogs: vi.fn().mockRejectedValueOnce(new Error("RPC")).mockResolvedValue([]) };
    const poll = createChainPoller(client, factory, vi.fn());
    await poll();
    await expect(poll()).rejects.toThrow("RPC");
    await poll();
    expect(client.getLogs.mock.calls.map(([call]) => call.fromBlock)).toEqual([101n, 101n]);
  });
});

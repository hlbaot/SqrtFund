import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNotificationItems, countUnseenNotifications, createNotificationSeenStore, notificationSeenKey, NOTIFICATION_SEEN_LIMIT, type NotificationItem } from "@/lib/notifications";

const wallet = "0xAbC";
const round = { roundAddress: "0xRoUnd", admin: "0xAdmin", finalized: false, isCancelled: false };
const project = { id: "1", ownerAddress: wallet, approved: true, rejected: false, claimed: false, totalDonatedRaw: 10n, estimatedMatchingRaw: 20n };
const two: NotificationItem[] = [
  { key: "projectApproved:0xround:1", scope: "activity" },
  { key: "claim:0xround:1", scope: "activity" },
];
let values: Map<string, string>;
let storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
beforeEach(() => {
  values = new Map();
  storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
});

describe("wallet notification sources", () => {
  it("has no event for a cancelled round without this wallet's refund or projects", () => {
    expect(buildNotificationItems({ address: wallet, round: { ...round, isCancelled: true }, refundTotal: 0n })).toEqual([]);
    // An available faucet is deliberately absent from the notification inputs.
    expect(buildNotificationItems({ address: wallet, round })).toEqual([]);
  });
  it("only creates a refund event for a positive refundable amount, once per round", () => {
    expect(buildNotificationItems({ address: wallet, round: { ...round, isCancelled: true }, refundTotal: 5n }))
      .toEqual([{ key: "refund:0xround", scope: "activity" }]);
    expect(buildNotificationItems({ address: wallet, round, refundTotal: 5n })).toEqual([]);
  });
  it("tracks approval, rejection and claims only for owned projects", () => {
    expect(buildNotificationItems({ address: wallet.toLowerCase(), round: { ...round, finalized: true }, projects: [project] })).toEqual(two);
    expect(buildNotificationItems({ address: "0xOther", round: { ...round, finalized: true }, projects: [project] })).toEqual([]);
    expect(buildNotificationItems({ address: wallet, round, projects: [{ ...project, approved: false, rejected: true }] }))
      .toEqual([{ key: "projectRejected:0xround:1", scope: "activity" }]);
    expect(buildNotificationItems({ address: wallet, round, projects: [{ ...project, approved: false }] })).toEqual([]);
  });
  it.each([
    { ...project, claimed: true }, { ...project, totalDonatedRaw: 0n, estimatedMatchingRaw: 0n },
    { ...project, approved: false }, { ...project, rejected: true },
  ])("does not count an unavailable claim: %s", p => {
    expect(buildNotificationItems({ address: wallet, round: { ...round, finalized: true }, projects: [p] }).some(item => item.key.startsWith("claim:"))).toBe(false);
  });
  it("never offers a claim for a cancelled round, even with stale finalized/payout data", () => {
    const items = buildNotificationItems({ address: wallet, round: { ...round, finalized: true, isCancelled: true }, projects: [project] });
    expect(items.some(item => item.key.startsWith("claim:"))).toBe(false);
  });
  it("only notifies the actual round admin about pending projects on an active round", () => {
    const input = { address: round.admin, round, projects: [{ ...project, approved: false }] };
    expect(buildNotificationItems(input)).toEqual([{ key: "projectPending:0xround:1", scope: "admin" }]);
    expect(buildNotificationItems({ ...input, address: wallet })).toEqual([]);
    expect(buildNotificationItems({ ...input, round: { ...round, finalized: true } })).toEqual([]);
    expect(buildNotificationItems({ ...input, round: { ...round, isCancelled: true } })).toEqual([]);
    expect(buildNotificationItems({ ...input, round: { ...round, status: "closed" } })).toEqual([]);
  });
  it("does not treat failed reads or disconnect as notifications", () => {
    expect(buildNotificationItems({ round, projects: [project] })).toEqual([]);
    expect(buildNotificationItems({ address: wallet, round: { ...round, isError: true }, projects: [project] })).toEqual([]);
  });
});

describe("unseen notification counts and persistence", () => {
  it("counts 0, then 2 new items, then 0 after viewing, then 1 new item", () => {
    const store = createNotificationSeenStore(() => storage);
    store.hydrate(wallet);
    expect(countUnseenNotifications([], store.snapshot(wallet).keys).activity).toBe(0);
    expect(countUnseenNotifications(two, store.snapshot(wallet).keys).activity).toBe(2);
    store.markSeen(wallet, two.map(item => item.key));
    expect(countUnseenNotifications(two, store.snapshot(wallet).keys).activity).toBe(0);
    const next: NotificationItem[] = [...two, { key: "projectRejected:0xround:2", scope: "activity" }];
    expect(countUnseenNotifications(next, store.snapshot(wallet).keys).activity).toBe(1);
    expect(two).toHaveLength(2); // Acknowledging does not remove financial actions.
  });
  it("deduplicates event keys and keeps admin counts separate", () => {
    expect(countUnseenNotifications([...two, two[0], { key: "projectPending:0xround:3", scope: "admin" }], []))
      .toEqual({ activity: 2, admin: 1, total: 3 });
  });
  it("normalizes wallet case and isolates a switched or disconnected wallet", () => {
    const store = createNotificationSeenStore(() => storage);
    store.markSeen(wallet, two.map(item => item.key));
    store.hydrate("0xOther");
    expect(countUnseenNotifications(two, store.snapshot("0xabc").keys).activity).toBe(0);
    expect(countUnseenNotifications(two, store.snapshot("0xOther").keys).activity).toBe(2);
    expect(store.snapshot(undefined)).toMatchObject({ ready: false, keys: [] });
    expect(values.has("sqrt-fund:notifications-seen:0xabc")).toBe(true);
    const reloaded = createNotificationSeenStore(() => storage);
    expect(reloaded.snapshot(wallet).ready).toBe(false);
    reloaded.hydrate(wallet);
    expect(countUnseenNotifications(two, reloaded.snapshot(wallet).keys).activity).toBe(0);
  });
  it("updates menu and wallet-dot subscribers immediately and handles cross-tab storage changes", () => {
    const store = createNotificationSeenStore(() => storage);
    const menu = vi.fn(), dot = vi.fn(), other = vi.fn();
    const unsubscribe = store.subscribe(wallet, menu);
    store.subscribe(wallet.toLowerCase(), dot);
    store.subscribe("0xOther", other);
    store.markSeen(wallet, [two[0].key]);
    expect(menu).toHaveBeenCalledTimes(1); expect(dot).toHaveBeenCalledTimes(1); expect(other).not.toHaveBeenCalled();
    store.stored(wallet, notificationSeenKey(wallet), JSON.stringify(two.map(item => item.key)));
    expect(countUnseenNotifications(two, store.snapshot(wallet).keys).activity).toBe(0);
    expect(menu).toHaveBeenCalledTimes(2); expect(dot).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.stored(wallet, notificationSeenKey("0xOther"), "[]");
    expect(dot).toHaveBeenCalledTimes(2);
    store.stored(wallet, null, null);
    expect(store.snapshot(wallet).keys).toEqual([]);
    expect(dot).toHaveBeenCalledTimes(3); expect(menu).toHaveBeenCalledTimes(2);
  });
  it("keeps seen state in memory if storage access, reads or writes throw", () => {
    for (const getStorage of [
      () => { throw new Error("blocked"); },
      () => ({ getItem: () => { throw new Error("read blocked"); }, setItem: () => { throw new Error("quota"); } }),
    ]) {
      const store = createNotificationSeenStore(getStorage);
      expect(() => store.hydrate(wallet)).not.toThrow();
      expect(() => store.markSeen(wallet, two.map(item => item.key))).not.toThrow();
      store.hydrate(wallet);
      expect(countUnseenNotifications(two, store.snapshot(wallet).keys).activity).toBe(0);
    }
  });
  it("ignores corrupt storage and limits persisted keys to the most recent 200", () => {
    const store = createNotificationSeenStore(() => storage);
    values.set(notificationSeenKey(wallet), "not JSON"); store.hydrate(wallet);
    expect(store.snapshot(wallet).keys).toEqual([]);
    store.markSeen(wallet, Array.from({ length: 250 }, (_, i) => `claim:round:${i}`));
    expect(store.snapshot(wallet).keys).toHaveLength(NOTIFICATION_SEEN_LIMIT);
    expect(store.snapshot(wallet).keys[0]).toBe("claim:round:50");
    expect(JSON.parse(values.get(notificationSeenKey(wallet))!)).toHaveLength(200);
  });
});

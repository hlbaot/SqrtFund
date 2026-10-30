import { claimCountdown } from "@/lib/claimWindow";
import { isPendingProject, isPublicProject } from "@/lib/projectVisibility";

export type NotificationItem = { key: string; scope: "activity" | "admin" };
type NotificationProject = {
  id: string; ownerAddress: string; approved: boolean; rejected?: boolean; claimed: boolean;
  totalDonatedRaw: bigint; estimatedMatchingRaw: bigint; finalMatchingRaw?: bigint;
};

/** Faucet availability is a standing shortcut, not a new wallet event. */
export function buildNotificationItems({ address, round, projects = [], refundTotal = 0n, now = 0 }: {
  address?: string;
  round: { roundAddress?: string; admin?: string; finalized: boolean; isCancelled: boolean; isError?: boolean; status?: string; finalizedAt?: number };
  projects?: readonly NotificationProject[];
  refundTotal?: bigint;
  now?: number;
}): NotificationItem[] {
  if (!address || !round.roundAddress || round.isError) return [];
  const wallet = address.toLowerCase();
  const roundKey = round.roundAddress.toLowerCase();
  const items: NotificationItem[] = [];
  const add = (key: string, scope: NotificationItem["scope"] = "activity") => items.push({ key, scope });
  if (round.isCancelled && refundTotal > 0n) add(`refund:${roundKey}`);
  for (const project of projects) {
    const id = `${roundKey}:${project.id}`;
    if (round.admin?.toLowerCase() === wallet && !round.finalized && !round.isCancelled && round.status !== "closed" && isPendingProject(project)) add(`projectPending:${id}`, "admin");
    if (project.ownerAddress.toLowerCase() !== wallet) continue;
    if (project.rejected) add(`projectRejected:${id}`);
    else if (isPublicProject(project)) add(`projectApproved:${id}`);
    if (round.finalized && !round.isCancelled && isPublicProject(project) && !project.claimed
      && project.finalMatchingRaw !== undefined && project.totalDonatedRaw + project.finalMatchingRaw > 0n) {
      add(`claim:${id}`);
      const window = claimCountdown(round.finalizedAt, now);
      if (window && window.stage !== "pending") add(`claimReminder:${id}:${window.stage}:${round.finalizedAt}`);
    }
  }
  return items;
}

export function countUnseenNotifications(items: readonly NotificationItem[], seen: readonly string[]) {
  const read = new Set(seen);
  const unseen = new Map(items.filter(item => !read.has(item.key)).map(item => [item.key, item]));
  const activity = [...unseen.values()].filter(item => item.scope === "activity").length;
  return { activity, admin: unseen.size - activity, total: unseen.size };
}

export const NOTIFICATION_SEEN_LIMIT = 200;
export const notificationSeenKey = (address: string) => `sqrt-fund:notifications-seen:${address.toLowerCase()}`;
export const EMPTY_SEEN = { ready: false, keys: [] as readonly string[] };

function boundedKeys(keys: readonly string[]) { return [...new Set([...keys].reverse())].reverse().slice(-NOTIFICATION_SEEN_LIMIT); }
function parseSeen(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? boundedKeys(parsed.filter((key): key is string => typeof key === "string" && key.length <= 200)) : [];
  } catch { return []; }
}

/** Shared snapshots update every navbar/menu subscriber immediately. */
export function createNotificationSeenStore(getStorage: () => Pick<Storage, "getItem" | "setItem">) {
  const snapshots = new Map<string, { ready: boolean; keys: readonly string[] }>();
  const listeners = new Map<string, Set<() => void>>();
  const read = (address: string) => {
    try { return parseSeen(getStorage().getItem(notificationSeenKey(address))); } catch { return []; }
  };
  const publish = (address: string, keys: readonly string[]) => {
    const wallet = address.toLowerCase();
    snapshots.set(wallet, { ready: true, keys: boundedKeys(keys) });
    listeners.get(wallet)?.forEach(listener => listener());
  };
  const store = {
    snapshot: (address?: string) => address ? snapshots.get(address.toLowerCase()) ?? EMPTY_SEEN : EMPTY_SEEN,
    hydrate(address: string) {
      // Called by an effect, never during render.
      publish(address, [...read(address), ...store.snapshot(address).keys]);
    },
    markSeen(address: string, keys: readonly string[]) {
      const merged = boundedKeys([...read(address), ...store.snapshot(address).keys, ...keys]);
      try { getStorage().setItem(notificationSeenKey(address), JSON.stringify(merged)); } catch { /* Session fallback. */ }
      publish(address, merged);
    },
    subscribe(address: string | undefined, listener: () => void) {
      if (!address) return () => {};
      const wallet = address.toLowerCase();
      const group = listeners.get(wallet) ?? new Set();
      listeners.set(wallet, group);
      group.add(listener);
      return () => { group.delete(listener); if (!group.size) listeners.delete(wallet); };
    },
    stored(address: string, key: string | null, newValue: string | null) {
      if (key === notificationSeenKey(address)) publish(address, parseSeen(newValue));
      else if (key === null) publish(address, []);
    },
  };
  return store;
}

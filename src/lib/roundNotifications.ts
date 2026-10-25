import type { Abi, Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { legacyProjectAbi } from "@/lib/contracts/legacyProjectAbi";
import { isVersionReadError } from "@/lib/contracts/roundReads";
import { buildNotificationItems } from "@/lib/notifications";
import type { NotificationItem } from "@/lib/notifications";

type Read = (call: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }) => Promise<unknown>;
type RawProject = { id: bigint; owner: Address; name: string; approved: boolean; rejected?: boolean };
export type RoundNotificationSnapshot = {
  roundAddress: Address; admin: Address; endTime: bigint; finalized: boolean; isCancelled: boolean;
  hasDonated?: boolean;
  projects: { id: string; name: string; ownerAddress: Address; approved: boolean; rejected: boolean;
    claimed: boolean; totalDonatedRaw: bigint; estimatedMatchingRaw: bigint }[];
};

/** Đọc hết các trang, gồm Round cũ; lỗi RPC không được hiểu là danh sách rỗng. */
export async function loadRoundNotificationSnapshot(read: Read, address: Address, wallet?: Address): Promise<RoundNotificationSnapshot> {
  const get = (functionName: string, args?: readonly unknown[]) => read({ address, abi: qfRoundAbi, functionName, args });
  const optionalBoolean = async (name: string, args?: readonly unknown[]) => {
    try { return await get(name, args) === true; }
    catch (error) { if (isVersionReadError(error)) return false; throw error; }
  };
  const [admin, endTime, finalized, isCancelled, supportsRejection] = await Promise.all([
    get("admin"), get("endTime"), get("finalized"), optionalBoolean("isCancelled"),
    get("rejected", [0n]).then(() => true).catch(error => { if (isVersionReadError(error)) return false; throw error; }),
  ]);
  const projects: RoundNotificationSnapshot["projects"] = [];
  let offset = 0n;
  for (;;) {
    const [page, total] = await read({ address, abi: supportsRejection ? qfRoundAbi : legacyProjectAbi,
      functionName: "getProjects", args: [offset, 50n] }) as [RawProject[], bigint];
    for (const project of page) projects.push({
      id: project.id.toString(), name: project.name, ownerAddress: project.owner,
      approved: project.approved, rejected: project.rejected === true,
      claimed: false, totalDonatedRaw: 0n, estimatedMatchingRaw: 0n,
    });
    offset += BigInt(page.length);
    if (offset >= total) break;
    if (!page.length) throw new Error("Incomplete project page");
  }
  const donated = wallet && wallet.toLowerCase() !== String(admin).toLowerCase() ? await Promise.all(projects.map(async project => {
    const amount = await get("donationOf", [wallet, BigInt(project.id)]);
    if (typeof amount !== "bigint") throw new Error("Invalid donation response");
    return amount > 0n;
  })) : [];
  return { roundAddress: address, admin: admin as Address, endTime: endTime as bigint, hasDonated: donated.some(Boolean),
    finalized: finalized === true, isCancelled, projects };
}

/** Distinct stable keys preserve acknowledgement across polling and reconnects. */
export function roundLifecycleNotificationItems(snapshot: RoundNotificationSnapshot, wallet: string, now: number): NotificationItem[] {
  const isAdmin = snapshot.admin.toLowerCase() === wallet.toLowerCase();
  if ((!isAdmin && !snapshot.hasDonated) || snapshot.isCancelled) return [];
  const scope = isAdmin ? "admin" as const : "activity" as const;
  const round = snapshot.roundAddress.toLowerCase();
  const items: NotificationItem[] = [];
  if (now > 0 && snapshot.endTime > 0n && BigInt(now) >= snapshot.endTime) items.push({ key: `roundEnded:${round}`, scope });
  if (snapshot.finalized) items.push({ key: `roundFinalized:${round}`, scope });
  return items;
}

export function roundProjectNotificationItems(snapshot: RoundNotificationSnapshot, wallet: string, now: number) {
  return buildNotificationItems({ address: wallet, round: { ...snapshot,
    status: now > 0 && BigInt(now) >= snapshot.endTime ? "closed" : "open" }, projects: snapshot.projects });
}

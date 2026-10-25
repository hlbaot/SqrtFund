import type { Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { loadRoundNotificationSnapshot } from "@/lib/roundNotifications";

type Read = Parameters<typeof loadRoundNotificationSnapshot>[0];
export type WalletDonation = {
  roundAddress: Address;
  endTime: bigint;
  finalized: boolean;
  isCancelled: boolean;
  project: { id: string; name: string; matching?: bigint };
  amount: bigint;
};

/** Read every project page, regardless of round lifecycle or project visibility. */
export async function loadWalletRoundDonations(read: Read, round: Address, wallet: Address,
  loadOriginal?: () => Promise<Record<string, bigint>>): Promise<WalletDonation[]> {
  const snapshot = await loadRoundNotificationSnapshot(read, round);
  // Refunds clear donationOf; retain the original contribution in personal history.
  const original = snapshot.isCancelled && loadOriginal ? await loadOriginal() : {};
  const donations = await Promise.all(snapshot.projects.map(async project => {
    const amount = await read({ address: round, abi: qfRoundAbi, functionName: "donationOf", args: [wallet, BigInt(project.id)] });
    if (typeof amount !== "bigint") throw new Error("Invalid donation response");
    const donated = original[project.id] ?? 0n;
    return { project, amount: donated > amount ? donated : amount };
  }));
  const supported = donations.filter(item => item.amount > 0n);
  if (!supported.length) return [];

  // A matching read failure must not hide an otherwise confirmed donation.
  let preview: [readonly bigint[], readonly bigint[]] | undefined;
  if (!snapshot.finalized && !snapshot.isCancelled) {
    try { preview = await read({ address: round, abi: qfRoundAbi, functionName: "previewMatching" }) as typeof preview; }
    catch { /* Display unavailable matching separately from donation history. */ }
  }
  return Promise.all(supported.map(async ({ project, amount }) => {
    let matching: bigint | undefined = snapshot.isCancelled ? 0n : undefined;
    if (snapshot.finalized) {
      try {
        const payout = await read({ address: round, abi: qfRoundAbi, functionName: "payoutOf", args: [BigInt(project.id)] });
        if (typeof payout === "bigint") matching = payout;
      } catch { /* Keep the donation visible when settlement cannot be read. */ }
    } else if (preview) {
      const index = preview[0].findIndex(id => id === BigInt(project.id));
      if (index >= 0) matching = preview[1][index];
    }
    return { roundAddress: round, endTime: snapshot.endTime, finalized: snapshot.finalized,
      isCancelled: snapshot.isCancelled, project: { id: project.id, name: project.name, matching }, amount };
  }));
}

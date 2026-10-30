import { decodeEventLog, type Address, type PublicClient, type TransactionReceipt } from "viem";
import { qfRoundAbi, roundFactoryAbi } from "@/lib/contracts/abis";
import { legacyProjectAbi } from "@/lib/contracts/legacyProjectAbi";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { loadRoundFields, isVersionReadError, type RoundFields, type RoundCapability } from "@/lib/contracts/roundReads";
import { SCALE, sqrtBigInt } from "@/lib/qf";
import type { ProjectContractItem, EnrichedProject } from "@/hooks/useProjects";
import { roundsStore, type StoredRound } from "./roundsStore";
import { projectsStore, projectKey, storedProject } from "./projectsStore";
import { organizerStore } from "./organizerStore";
import type { StoreChange } from "./mirror";

const capabilities = new Map<string, RoundCapability>();
const key = (value: string) => value.toLowerCase();
export function patchReceipt(receipt: TransactionReceipt) {
  const changes: StoreChange[] = [], rounds = new Set<Address>(), organizers = new Set<Address>();
  for (const log of receipt.logs) {
    if (key(log.address) === key(factoryAddress)) {
      try {
        const event = decodeEventLog({ abi: roundFactoryAbi, data: log.data, topics: log.topics });
        if (event.eventName === "RoundCreated") {
          const a = event.args.roundAddress;
          rounds.add(a);
          changes.push(roundsStore.getState().upsert({ id: a, address: a, admin: event.args.admin, name: event.args.name }, true));
        }
        if (event.eventName === "OrganizerUpdated") {
          const a = event.args.organizer;
          organizers.add(a);
          changes.push(organizerStore.getState().upsert({ id: a, authorized: event.args.authorized, confirmedBlock: receipt.blockNumber }, true));
        }
      } catch { /* Unrelated token/ownership events do not update permissions. */ }
      continue;
    }
    if (!roundsStore.getState().entities[key(log.address)] && ![...rounds].some(a => key(a) === key(log.address))) continue;
    try {
      const event = decodeEventLog({ abi: qfRoundAbi, data: log.data, topics: log.topics });
      rounds.add(log.address);
      const patchProject = (id: bigint, patch: Partial<EnrichedProject>) => {
        changes.push(projectsStore.getState().patch(projectKey(log.address, id), patch, true));
      };
      const patchField = (index: number, value: unknown) => {
        const previous = roundsStore.getState().entities[key(log.address)];
        if (!previous?.fields) return;
        const results = [...previous.fields.results]; results[index] = { status: "success", result: value };
        changes.push(roundsStore.getState().patch(log.address, { fields: { ...previous.fields, results } }, true));
      };
      switch (event.eventName) {
        case "ProjectRegistered": {
          const { id, owner, name } = event.args;
          changes.push(projectsStore.getState().upsert(storedProject({ id: id.toString(), contractId: id, roundId: log.address,
            name, ownerAddress: owner, description: "", shortDescription: "", category: "uncategorized", imageUrl: "/images/placeholder.svg", contactUrl: "",
            status: "pending", approved: false, rejected: false, claimed: false,
            sumSqrtRaw: 0n, totalDonatedRaw: 0n, estimatedMatchingRaw: 0n, totalDonated: 0, estimatedMatching: 0, supporterCount: 0,
          }), true));
          patchField(11, id); break;
        }
        case "ProjectApproved": patchProject(event.args.id, { approved: true, rejected: false, status: "approved" }); break;
        case "ProjectRejected": patchProject(event.args.id, { approved: false, rejected: true, status: "rejected" }); break;
        case "Donated": {
          const { projectId, amount, newTotal } = event.args;
          const previous = projectsStore.getState().entities[projectKey(log.address, projectId)];
          if (!previous) break;
          const first = newTotal === amount;
          const sumSqrtRaw = previous.sumSqrtRaw + sqrtBigInt(newTotal * SCALE) - sqrtBigInt((newTotal - amount) * SCALE);
          patchProject(projectId, { totalDonatedRaw: previous.totalDonatedRaw + amount,
            totalDonated: Number(previous.totalDonatedRaw + amount) / 1e6, sumSqrtRaw,
            supporterCount: previous.supporterCount + (first ? 1 : 0) }); break;
        }
        case "Refunded": {
          const { projectId, amount } = event.args;
          const previous = projectsStore.getState().entities[projectKey(log.address, projectId)];
          if (!previous) break;
          patchProject(projectId, { totalDonatedRaw: previous.totalDonatedRaw - amount,
            totalDonated: Number(previous.totalDonatedRaw - amount) / 1e6,
            sumSqrtRaw: previous.sumSqrtRaw - sqrtBigInt(amount * SCALE), supporterCount: Math.max(0, previous.supporterCount - 1) }); break;
        }
        case "Claimed": patchProject(event.args.projectId, { claimed: true }); break;
        case "Finalized": patchField(8, true); patchField(9, event.args.leftover); break;
        case "RoundCancelled": patchField(15, true); break;
        case "PoolDeposited": patchField(7, event.args.totalPool); break;
        case "CancelledPoolWithdrawn": patchField(16, true); break;
        case "LeftoverWithdrawn": patchField(10, true); break;
      }
    } catch { /* Unknown events cannot mutate the mirror. */ }
  }
  return { changes, rounds: [...rounds], organizers: [...organizers] };
}

export async function readMirrorRound(client: PublicClient, address: Address, blockNumber?: bigint): Promise<RoundFields> {
  return loadRoundFields(contracts => client.multicall({ contracts, allowFailure: true, ...(blockNumber === undefined ? {} : { blockNumber }) }), address, capabilities);
}
export async function readMirrorProjects(client: PublicClient, address: Address, fields: RoundFields, blockNumber: bigint) {
  let supportsRejection = true;
  try { await client.readContract({ address, abi: qfRoundAbi, functionName: "rejected", args: [0n], blockNumber }); }
  catch (error) { if (isVersionReadError(error)) supportsRejection = false; else throw error; }
  const [raw] = await client.readContract({ address, abi: supportsRejection ? qfRoundAbi : legacyProjectAbi,
    functionName: "getProjects", args: [0n, 50n], blockNumber }) as [readonly ProjectContractItem[], bigint];
  let estimates = new Map<string, bigint>();
  const finalized = fields.results[8]?.result === true;
  if (!finalized) {
    const [ids, values] = await client.readContract({ address, abi: qfRoundAbi, functionName: "previewMatching", blockNumber });
    estimates = new Map(ids.map((id, index) => [id.toString(), values[index]]));
  }
  const payouts = finalized && raw.length ? await client.multicall({ allowFailure: true, blockNumber,
    contracts: raw.map(p => ({ address, abi: qfRoundAbi, functionName: "payoutOf" as const, args: [p.id] as const })) }) : [];
  return raw.map((p, index) => {
    const estimatedMatchingRaw = estimates.get(p.id.toString()) ?? 0n;
    const payout = payouts[index];
    const finalMatchingRaw = finalized && payout?.status === "success" ? payout.result as bigint : undefined;
    return storedProject({ id: p.id.toString(), contractId: p.id, roundId: address, name: p.name,
      description: p.description, shortDescription: p.description.slice(0, 100), imageUrl: p.imageUrl || "/images/placeholder.svg",
      contactUrl: p.link, category: "uncategorized", ownerAddress: p.owner, approved: p.approved, rejected: p.rejected === true,
      status: p.rejected ? "rejected" : p.approved ? "approved" : "pending", claimed: p.claimed,
      supporterCount: Number(p.donorCount), totalDonatedRaw: p.totalDonated, sumSqrtRaw: p.sumSqrt,
      estimatedMatchingRaw, totalDonated: Number(p.totalDonated) / 1e6, estimatedMatching: Number(estimatedMatchingRaw) / 1e6,
      finalMatchingRaw, finalMatching: finalMatchingRaw === undefined ? undefined : Number(finalMatchingRaw) / 1e6,
    });
  });
}

/** Read a single pinned block, then publish one coherent confirmed snapshot. */
export async function readMirrorSnapshot(client: PublicClient, addresses: Address[], wallets: Address[], blockNumber?: bigint) {
  const sourceTime = Date.now();
  const block = blockNumber ?? await client.getBlockNumber({ cacheTime: 0 });
  const roundSnapshots = await Promise.all(addresses.map(async address => {
    const fields = await readMirrorRound(client, address, block);
    if (fields.results.slice(0, 12).some(result => result.status === "failure")) throw new Error("Round snapshot incomplete");
    const projects = await readMirrorProjects(client, address, fields, block);
    return { round: { id: address, address, fields, name: fields.results[12]?.result as string | undefined,
      admin: fields.results[0]?.result as Address, confirmedBlock: block } satisfies StoredRound, projects };
  }));
  const permissions = await Promise.all(wallets.map(async wallet => ({ id: wallet,
    authorized: await client.readContract({ address: factoryAddress, abi: roundFactoryAbi, functionName: "authorizedOrganizers", args: [wallet], blockNumber: block }),
  })));
  return () => {
    const monotonic = roundSnapshots.filter(snapshot => block >= (roundsStore.getState().entities[key(snapshot.round.address)]?.confirmedBlock ?? 0n));
    roundsStore.getState().hydrate(monotonic.map(s => s.round), sourceTime);
    projectsStore.getState().hydrate(monotonic.flatMap(s => s.projects), sourceTime);
    organizerStore.getState().hydrate(permissions.filter(p => block >= (organizerStore.getState().entities[key(p.id)]?.confirmedBlock ?? 0n)).map(p => ({ ...p, confirmedBlock: block })), sourceTime);
  };
}
export async function refreshUiStores(client: PublicClient, wallet?: Address) {
  if (client.chain?.id !== undefined && client.chain.id !== TARGET_CHAIN_ID) return;
  const sourceTime = Date.now(), blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const addresses = await client.readContract({ address: factoryAddress, abi: roundFactoryAbi, functionName: "getRounds", blockNumber });
  roundsStore.getState().hydrate(addresses.map(address => ({ id: address, address })), sourceTime);
  // Independent rounds: an unsupported historical round must not stop current ones.
  await Promise.allSettled(addresses.map(async address => (await readMirrorSnapshot(client, [address], [], blockNumber))()));
  if (wallet) (await readMirrorSnapshot(client, [], [wallet], blockNumber))();
}

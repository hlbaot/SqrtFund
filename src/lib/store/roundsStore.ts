import type { Address } from "viem";
import type { RoundFields } from "@/lib/contracts/roundReads";
import type { RoundSummary } from "@/components/leaderboard/model";
import { createMirrorStore } from "./mirror";
export type StoredRound = {
  id: string; address: Address; name?: string; admin?: Address;
  summary?: { round: RoundSummary; loading: boolean };
  fields?: RoundFields; confirmedBlock?: bigint;
};
export const roundsStore = createMirrorStore<StoredRound, { rounds: StoredRound[] }>(entities => ({ rounds: Object.values(entities) }));
export const EMPTY_ROUNDS: StoredRound[] = [];

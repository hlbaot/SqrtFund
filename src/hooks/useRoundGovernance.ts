"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignMessage, useAccount } from "wagmi";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { PROFILE_TTL } from "@/lib/projectProfile";
import { governanceMessage, parseGovernance, type GovernanceChange, type GovernanceRecord } from "@/lib/roundGovernance";
export function useRoundGovernance(round?: string) {
  return useQuery({ queryKey: ["round-governance", round?.toLowerCase()], enabled: Boolean(round), retry: 1, queryFn: async () => {
    const r = await fetch(`/api/round-governance?round=${round}`, { cache: "no-store" });
    const x = await r.json(); if (!r.ok || !Array.isArray(x.records)) throw Error(x.code ?? "GOVERNANCE_UNAVAILABLE");
    return x.records as GovernanceRecord[];
  } });
}
export function usePublishGovernance() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const query = useQueryClient();
  return async (input: GovernanceChange, transactionHash?: string) => {
    if (!address || !isConnected || chainId !== TARGET_CHAIN_ID) throw Error("GOVERNANCE_FORBIDDEN");
    const change = parseGovernance(input); const issuedAt = Date.now();
    const permit = { wallet: address.toLowerCase(), chainId: TARGET_CHAIN_ID, origin: window.location.origin, issuedAt, expiresAt: issuedAt + PROFILE_TTL };
    const signature = await signMessageAsync({ account: address, message: governanceMessage(change, permit) });
    const r = await fetch("/api/round-governance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...change, transactionHash, permit, signature }) });
    const x = await r.json(); if (!r.ok || !x.record?.id) throw Error(x.code ?? "GOVERNANCE_UNAVAILABLE");
    await query.invalidateQueries({ queryKey: ["round-governance", change.round] });
    return x.record as GovernanceRecord;
  };
}

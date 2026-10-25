"use client";
import { roundsStore } from "@/lib/store/roundsStore";
import { useShallow } from "zustand/react/shallow";
import { isPublicProject } from "@/lib/projectVisibility";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { isPublicRound } from "@/lib/roundVisibility";
import { useFactoryRounds, useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useRole } from "@/hooks/useRole";
import { Container } from "@/components/layout/Container";
import { RoundsList } from "@/components/rounds/RoundsList";
import type { RoundSummary } from "@/components/leaderboard/model";

type LoadedRound = { round: RoundSummary; loading: boolean };

// Adapters use the repository's existing hooks; presentation components never read contracts.
function RoundData({ address, number, onData, retry }: { address: Address; number: number; onData: (address: string, data: LoadedRound) => void; retry: number }) {
  const source = useRound(address);
  const refetchFields = source.refetch;
  const { projects, isLoading, isError, readFailureKind: projectFailure, refetch } = useProjects(address);
  const now = useCurrentTimestamp();
  const upcoming = source.status === "open" && now > 0 && Number(source.startTime ?? 0n) > now;
  const data = useMemo<LoadedRound>(() => {
    const approved = projects.filter(isPublicProject);
    return { round: {
      id: address, number, version: source.roundVersion,
      readError: source.isError || isError ? (source.readFailureKind === "version" || projectFailure === "version" ? "version" : "rpc") : undefined,
      title: source.name ?? "", name: source.name, organizer: source.organizer,
      description: "", sponsorName: "", status: source.status,
      phase: upcoming ? "upcoming" : source.status,
      matchingPool: Number(source.pool) / 1_000_000, totalDonated: approved.reduce((sum, p) => sum + p.totalDonated, 0),
      totalSupporters: approved.reduce((sum, p) => sum + p.supporterCount, 0), projectCount: approved.length,
      startTime: new Date(Number(source.startTime ?? 0n) * 1000).toISOString(), endTime: new Date(Number(source.endTime ?? 0n) * 1000).toISOString(),
    }, loading: source.isLoading || isLoading };
  }, [address, number, source.name, source.organizer, source.status, source.startTime, source.endTime, source.pool, source.isLoading, source.isError, source.roundVersion, source.readFailureKind, projects, isLoading, isError, projectFailure, upcoming]);
  useEffect(() => { onData(address, data); }, [address, data, onData]);
  // The existing hooks poll; explicitly refresh their project query on Retry as well.
  useEffect(() => { if (retry > 0) { refetchFields(); void refetch(); } }, [retry, refetch, refetchFields]);
  return null;
}

export function RoundsView() {
  const { factoryData, isFactoryLoading: isLoading, isFactoryError, refetchFactory: refetch } = useFactoryRounds();
  // Giữ số thứ tự gốc của Factory khi ẩn vòng demo cũ khỏi danh sách công khai.
  const allRounds = useMemo(() => ((factoryData?.[0]?.result as Address[] | undefined) ?? [])
    .map((address, index) => ({ address, number: index + 1 }))
    .filter(round => isPublicRound(round.address, TARGET_CHAIN_ID)), [factoryData]);
  const discoveryError = isFactoryError || factoryData?.[0]?.status === "failure";
  const { role, isReady } = useRole();
  const stored = roundsStore(useShallow(state => state.entities));
  const [retry, setRetry] = useState(0);
  const onData = useCallback((address: string, data: LoadedRound) => {
    // Summary snapshots have the same receipt fence as the raw fields.
    roundsStore.getState().hydrate([{ id: address, address: address as Address, summary: data }]);
  }, []);
  const entries = allRounds.map(({ address }) => stored[address.toLowerCase()]?.summary);
  const loading = isLoading || (entries.length > 0 && entries.every(entry => !entry || entry.loading));
  const error = discoveryError && allRounds.length === 0;
  return <Container className="competition-page min-w-0 py-8 sm:py-10">
    {allRounds.map(({ address, number }) => <RoundData key={`${address}:${retry}`} address={address} number={number} onData={onData} retry={retry} />)}
    <RoundsList paginationReady={!isLoading && entries.every(entry => entry && !entry.loading)} rounds={entries.flatMap(entry => entry && !entry.loading ? [entry.round] : [])} state={error ? "error" : loading ? "loading" : "ready"} isAdmin={isReady && role === "admin"} onRetry={() => { refetch(); setRetry(value => value + 1); }} />
  </Container>;
}

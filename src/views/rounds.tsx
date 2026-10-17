"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
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
    const approved = projects.filter(project => project.approved);
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
  const allRounds = (factoryData?.[0]?.result as Address[] | undefined) ?? [];
  const discoveryError = isFactoryError || factoryData?.[0]?.status === "failure";
  const { role, isReady } = useRole();
  const [loaded, setLoaded] = useState<Record<string, LoadedRound>>({});
  const [retry, setRetry] = useState(0);
  const onData = useCallback((address: string, data: LoadedRound) => { setLoaded(current => ({ ...current, [address]: data })); }, []);
  const entries = allRounds.map(address => loaded[address]);
  const loading = isLoading || (entries.length > 0 && entries.every(entry => !entry || entry.loading));
  const error = discoveryError && allRounds.length === 0;
  return <Container className="competition-page min-w-0 py-8 sm:py-10">
    {allRounds.map((address, index) => <RoundData key={`${address}:${retry}`} address={address} number={index + 1} onData={onData} retry={retry} />)}
    <RoundsList rounds={entries.flatMap(entry => entry && !entry.loading ? [entry.round] : [])} state={error ? "error" : loading ? "loading" : "ready"} isAdmin={isReady && role === "admin"} onRetry={() => { refetch(); setRetry(value => value + 1); }} />
  </Container>;
}

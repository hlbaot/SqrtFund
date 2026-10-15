"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useRole } from "@/hooks/useRole";
import { Container } from "@/components/layout/Container";
import { RoundsList } from "@/components/rounds/RoundsList";
import type { RoundSummary } from "@/components/leaderboard/model";

type LoadedRound = { round: RoundSummary; loading: boolean; error: boolean };

// Adapters use the repository's existing hooks; presentation components never read contracts.
function RoundData({ address, number, onData, retry }: { address: Address; number: number; onData: (address: string, data: LoadedRound) => void; retry: number }) {
  const source = useRound(address);
  const { projects, isLoading, isError, refetch } = useProjects(address);
  const now = useCurrentTimestamp();
  const upcoming = source.status === "open" && now > 0 && Number(source.startTime ?? 0n) > now;
  const data = useMemo<LoadedRound>(() => {
    const approved = projects.filter(project => project.approved);
    return { round: {
      id: address, number, title: source.name ?? "", name: source.name, organizer: source.organizer,
      description: "", sponsorName: "", status: source.status,
      phase: upcoming ? "upcoming" : source.status,
      matchingPool: Number(source.pool) / 1_000_000, totalDonated: approved.reduce((sum, p) => sum + p.totalDonated, 0),
      totalSupporters: approved.reduce((sum, p) => sum + p.supporterCount, 0), projectCount: approved.length,
      startTime: new Date(Number(source.startTime ?? 0n) * 1000).toISOString(), endTime: new Date(Number(source.endTime ?? 0n) * 1000).toISOString(),
    }, loading: source.isLoading || isLoading, error: source.isError || isError };
  }, [address, number, source.name, source.organizer, source.status, source.startTime, source.endTime, source.pool, source.isLoading, source.isError, projects, isLoading, isError, upcoming]);
  useEffect(() => { onData(address, data); }, [address, data, onData]);
  // The existing hooks poll; explicitly refresh their project query on Retry as well.
  useEffect(() => { if (retry > 0) void refetch(); }, [retry, refetch]);
  return null;
}

export function RoundsView() {
  const { allRounds, isLoading, isError, refetch } = useRound();
  const { role, isReady } = useRole();
  const [loaded, setLoaded] = useState<Record<string, LoadedRound>>({});
  const [retry, setRetry] = useState(0);
  const onData = useCallback((address: string, data: LoadedRound) => { setLoaded(current => ({ ...current, [address]: data })); }, []);
  const entries = allRounds.map(address => loaded[address]);
  const loading = isLoading || entries.some(entry => !entry || entry.loading);
  const error = isError || entries.some(entry => entry?.error);
  return <Container className="competition-page min-w-0 py-8 sm:py-10">
    {allRounds.map((address, index) => <RoundData key={`${address}:${retry}`} address={address} number={index + 1} onData={onData} retry={retry} />)}
    <RoundsList rounds={entries.flatMap(entry => entry ? [entry.round] : [])} state={error ? "error" : loading ? "loading" : "ready"} isAdmin={isReady && role === "admin"} onRetry={() => { refetch(); setRetry(value => value + 1); }} />
  </Container>;
}

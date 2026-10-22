"use client";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
import { isPublicProject } from "@/lib/projectVisibility";
import { calculateRoundStats } from "@/lib/roundStats";
import { MatchingPoolWarning } from "@/components/project/MatchingPoolWarning";
import { computeRawMatching } from "@/lib/qf";
import { RoundCancellationPanel } from "@/components/round/RoundCancellationPanel";
import { StudentVerifyBox } from "@/components/verify/DeferredStudentVerifyBox";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { Container } from "@/components/layout/Container";
import { RoundHeader, type RoundChoice } from "@/components/leaderboard/RoundHeader";
import { Leaderboard, LeaderboardSkeleton } from "@/components/leaderboard/Leaderboard";
import { PresentationState } from "@/components/rounds/RoundsList";
import type { RoundPhase, RoundSummary } from "@/components/leaderboard/model";
import { startRouteProgress } from "@/lib/navigationProgress";

function RoundChoiceData({ address, onData }: { address: Address; onData: (id: string, phase: RoundPhase) => void }) {
  const round = useRound(address);
  const now = useCurrentTimestamp();
  const phase = round.status === "open" && now > 0 && Number(round.startTime ?? 0n) > now ? "upcoming" : round.status;
  useEffect(() => { if (!round.isLoading && !round.isError) onData(address, phase); }, [address, phase, round.isLoading, round.isError, onData]);
  return null;
}

export function RoundDetailView() {
  const params = useParams();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const { t } = useLocale();
  const { address } = useAccount();
  const { role, isReady } = useRole();
  const now = useCurrentTimestamp();
  const round = useRound(isAddress(rawId) ? rawId : undefined);
  const { projects, isLoading, isError, refetch } = useProjects(round.roundAddress);
  const [phases, setPhases] = useState<Record<string, RoundPhase>>({});
  const onData = useCallback((id: string, phase: RoundPhase) => { setPhases(current => current[id] === phase ? current : { ...current, [id]: phase }); }, []);
  const approved = useMemo(() => projects.filter(isPublicProject), [projects]);
  const stats = useMemo(() => calculateRoundStats(projects), [projects]);
  const number = Math.max(1, round.allRounds.findIndex(id => id.toLowerCase() === round.roundAddress?.toLowerCase()) + 1);
  const summary: RoundSummary = {
    id: round.roundAddress ?? "", number, title: round.name ?? "", name: round.name, description: "", sponsorName: "", organizer: round.organizer,
    startTime: new Date(Number(round.startTime ?? 0n) * 1000).toISOString(), endTime: new Date(Number(round.endTime ?? 0n) * 1000).toISOString(), status: round.status,
    phase: round.status === "open" && now > 0 && Number(round.startTime ?? 0n) > now ? "upcoming" : round.status,
    matchingPool: Number(round.pool) / 1_000_000, projectCount: stats.approvedCount,
    totalDonated: stats.totalDonated, totalSupporters: stats.totalSupporters,
  };
  const choices: RoundChoice[] = round.allRounds.map((id, index) => ({ id, number: index + 1, phase: phases[id] }));
  const loading = round.isLoading || isLoading;
  const error = round.isError || isError;
  const exists = Boolean(round.roundAddress) && (!rawId.startsWith("0x") || isAddress(rawId));
  return <Container className="competition-page min-h-[calc(100dvh-102px)] min-w-0 space-y-8 py-6 sm:py-8">
    {round.allRounds.map(id => <RoundChoiceData key={id} address={id} onData={onData} />)}
    {loading ? <><div role="status" aria-label={t.competition.loading} className="competition-skeleton h-[330px] border border-line bg-surface" /><LeaderboardSkeleton /></> : error ? <PresentationState state="error" onRetry={() => { round.refetch(); void refetch(); }} /> : !exists ? <PresentationState state="empty"><h1>{t.competition.notFound}</h1><p className="mt-2 text-sm text-muted">{t.competition.notFoundHint}</p><Link href="/rounds" className="competition-action mt-5 inline-flex">{t.competition.rounds}</Link></PresentationState> : <>
      <RoundCancellationPanel projectNames={Object.fromEntries(projects.map(project => [project.id, project.name]))} roundAddress={round.roundAddress} />
      <StudentVerifyBox />
      <RoundHeader round={summary} choices={choices.length ? choices : [{ id: summary.id, number: summary.number, phase: summary.phase }]} onRoundChange={id => { startRouteProgress(`/round/${id}`); router.push(`/round/${id}`); }} finalPayoutsAvailable={approved.every(project => project.finalMatching !== undefined)} />
      <div className="flex flex-wrap items-center gap-4">
        <ExplorerLink address={round.roundAddress} label={t.onChain.roundContract} />
        <ExplorerLink address={round.roundAddress} transactions label={t.onChain.allTransactions} />
      </div>
      {!round.isCancelled && <MatchingPoolWarning totalRaw={approved.reduce((sum, p) => sum + computeRawMatching(p.sumSqrtRaw, p.totalDonatedRaw), 0n)} pool={round.pool} />}
      <Leaderboard cancelled={round.isCancelled} projects={approved} roundId={summary.id} pool={summary.matchingPool} finalized={round.finalized} wallet={address} isAdmin={isReady && role === "admin"} onRetry={() => { round.refetch(); void refetch(); }} />
    </>}
  </Container>;
}

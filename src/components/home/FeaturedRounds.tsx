"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRoundSummaries, pickFeaturedRounds, type RoundSummary } from "@/hooks/useRoundSummaries";
import { isPublicProject } from "@/lib/projectVisibility";
import { RoundCard } from "@/components/round/RoundCard";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MonoLabel } from "@/components/ui/MonoLabel";
import type { Round } from "@/types";

/** Featured project = most supporters first, then most money raised. */
function useRoundData(summary: RoundSummary) {
  const { t } = useLocale();
  const round = useRound(summary.address);
  const { projects, isLoading } = useProjects(summary.address);

  const approved = useMemo(
    () => projects.filter(isPublicProject).sort((a, b) => b.supporterCount - a.supporterCount || b.totalDonated - a.totalDonated),
    [projects],
  );

  const data: Round = useMemo(() => ({
    id: summary.address,
    title: round.name?.trim() || `${t.homeIntro.roundTitle} #${summary.index}`,
    description: round.organizer?.trim() || "",
    name: round.name,
    organizer: round.organizer,
    matchingPool: Number(round.pool) / 1_000_000,
    totalDonated: approved.reduce((a, p) => a + p.totalDonated, 0),
    totalSupporters: approved.reduce((a, p) => a + p.supporterCount, 0),
    projectCount: approved.length,
    startTime: round.startTime ? new Date(Number(round.startTime) * 1000).toISOString() : new Date().toISOString(),
    endTime: round.endTime ? new Date(Number(round.endTime) * 1000).toISOString() : new Date().toISOString(),
    status: round.status,
    sponsorName: round.organizer?.trim() || "",
  }), [summary, round.name, round.organizer, round.pool, round.startTime, round.endTime, round.status, approved, t.homeIntro.roundTitle]);

  return { round, approved, data, isLoading: isLoading || round.isLoading };
}

function FeaturedRoundItem({ summary }: { summary: RoundSummary }) {
  const { round, data } = useRoundData(summary);
  return <RoundCard round={data} adminAddress={round.admin} roundIndex={summary.index} />;
}

function FeaturedProjectsOfRound({ summary }: { summary: RoundSummary }) {
  const isVi = useLocale().locale === "vi";
  const { round, approved, data, isLoading } = useRoundData(summary);
  const top = approved.slice(0, 2);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 border-l-2 border-primary pl-3">
        <div className="min-w-0">
          <MonoLabel className="text-muted">{isVi ? `VÒNG #${summary.index}` : `ROUND #${summary.index}`}</MonoLabel>
          <h3 className="truncate text-lg font-bold text-foreground">{data.title}</h3>
        </div>
        <Link href={`/round/${summary.address}`} className="mono-label inline-flex shrink-0 items-center gap-1 text-primary hover:underline">
          {isVi ? "Xem vòng" : "View round"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      ) : top.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-sm text-muted">
          {isVi ? "Vòng này chưa có dự án được duyệt." : "No approved projects in this round yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {top.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={{ ...project, rank: index + 1 }}
              roundId={summary.address}
              roundAddress={summary.address}
              canDonate={!round.isCancelled && round.status === "open"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeaturedRoundsSection() {
  const { locale, t } = useLocale();
  const isVi = locale === "vi";
  const router = useRouter();
  const { summaries, isLoading, isError } = useRoundSummaries();
  const featured = useMemo(() => pickFeaturedRounds(summaries), [summaries]);
  if (isError && featured.length === 0) return null;
  return (
    <section id="current-round" className="chain-lattice-host scroll-mt-20">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-[clamp(3rem,6vw,6rem)] sm:px-6 lg:px-8" data-aos="fade-up" data-aos-duration="700">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <MonoLabel className="text-primary">{isVi ? "QUỸ ĐỐI ỨNG" : "MATCHING POOLS"}</MonoLabel>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{isVi ? "Vòng tài trợ nổi bật" : "Featured funding rounds"}</h2>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {isVi ? "Ưu tiên vòng đang mở, sau đó theo quy mô quỹ đối ứng." : "Open rounds first, then by matching pool size."}
            </p>
          </div>
          <Link href="/rounds" className="mono-label inline-flex items-center gap-1 text-primary hover:underline">
            {isVi ? "Tất cả vòng" : "All rounds"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {isLoading && featured.length === 0 ? (
          <Skeleton className="h-64" />
        ) : featured.length === 0 ? (
          <EmptyState title={t.homeIntro.noProjectsTitle} description={isVi ? "Chưa có vòng tài trợ nào." : "No funding rounds yet."} actionLabel={isVi ? "Xem vòng" : "Browse rounds"} onAction={() => router.push("/rounds")} />
        ) : (
          <div className="space-y-6">{featured.map((s) => <FeaturedRoundItem key={s.address} summary={s} />)}</div>
        )}
      </div>
    </section>
  );
}

export function FeaturedProjectsSection() {
  const { locale, t } = useLocale();
  const isVi = locale === "vi";
  const { summaries, isLoading } = useRoundSummaries();
  const featured = useMemo(() => pickFeaturedRounds(summaries), [summaries]);
  return (
    <section id="projects-list" className="chain-lattice-host scroll-mt-20">
      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-[clamp(3rem,6vw,6rem)] sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-end" data-aos="fade-up" data-aos-duration="600">
          <div>
            <MonoLabel className="text-primary">{t.homeIntro.projectsEyebrow}</MonoLabel>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{isVi ? "Dự án nổi bật theo từng vòng" : "Featured projects by round"}</h2>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {isVi ? "Xếp theo số người ủng hộ, sau đó theo số tiền đã nhận." : "Ranked by supporters, then by amount raised."}
            </p>
          </div>
        </div>
        {isLoading && featured.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
        ) : (
          featured.map((s) => <FeaturedProjectsOfRound key={s.address} summary={s} />)
        )}
      </div>
    </section>
  );
}

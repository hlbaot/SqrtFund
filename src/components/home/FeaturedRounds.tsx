"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRoundSummaries, pickFeaturedRounds, type RoundSummary } from "@/hooks/useRoundSummaries";
import { isPublicProject } from "@/lib/projectVisibility";
import { RoundCard } from "@/components/round/RoundCard";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Round } from "@/types";

const gridClass = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";
const sectionContentClass = "mx-auto w-full max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8";
const featuredLimit = 3;

function useFeaturedRound(summary?: RoundSummary) {
  const { t } = useLocale();
  const round = useRound(summary?.address);
  const { projects, isLoading, isError } = useProjects(summary?.address, { enabled: Boolean(summary) });
  const approved = useMemo(() => projects.filter(isPublicProject), [projects]);
  if (!summary) return undefined;

  const data: Round = {
    id: summary.address,
    title: round.name?.trim() || `${t.homeIntro.roundTitle} #${summary.index}`,
    description: round.organizer?.trim() || "",
    name: round.name,
    organizer: round.organizer,
    matchingPool: summary.poolUsdc,
    totalDonated: approved.reduce((total, project) => total + project.totalDonated, 0),
    totalSupporters: approved.reduce((total, project) => total + project.supporterCount, 0),
    projectCount: approved.length,
    startTime: round.startTime ? new Date(Number(round.startTime) * 1000).toISOString() : "",
    endTime: round.endTime ? new Date(Number(round.endTime) * 1000).toISOString() : "",
    status: round.status,
    sponsorName: round.organizer?.trim() || "",
  };

  return {
    address: summary.address,
    index: summary.index,
    data,
    approved,
    canDonate: !round.isCancelled && round.status === "open",
    isLoading: isLoading || round.isLoading,
    isError: isError || round.isError,
  };
}

export function FeaturedFundingSections() {
  const { locale, t } = useLocale();
  const isVi = locale === "vi";
  const { summaries, isLoading, isError } = useRoundSummaries();
  const [first, second, third] = pickFeaturedRounds(summaries, featuredLimit);
  const firstRound = useFeaturedRound(first);
  const secondRound = useFeaturedRound(second);
  const thirdRound = useFeaturedRound(third);
  const rounds = [firstRound, secondRound, thirdRound].filter(round => round !== undefined);
  const featuredProjects = rounds
    .flatMap(({ address, approved, canDonate }) => approved.map(project => ({ project, address, canDonate })))
    .sort((a, b) => b.project.supporterCount - a.project.supporterCount || b.project.totalDonated - a.project.totalDonated)
    .slice(0, featuredLimit);
  const roundsPending = isLoading && !isError;
  const projectsPending = roundsPending || rounds.some(round => round.isLoading);
  const projectsFailed = isError || rounds.some(round => round.isError);

  return (
    <>
      {(!isError || rounds.length > 0) && (
        <section id="current-round" className="chain-lattice-host scroll-mt-20">
          <div className={`${sectionContentClass} pb-5 pt-10 sm:pt-12 lg:pt-14`} data-aos="fade-up" data-aos-duration="700">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{isVi ? "Vòng tài trợ nổi bật" : "Featured funding rounds"}</h2>
                <p className="mt-1 text-xs text-muted sm:text-sm">
                  {isVi ? "Ưu tiên vòng đang mở, sau đó theo quy mô quỹ đối ứng." : "Open rounds first, then by matching pool size."}
                </p>
              </div>
              <Link href="/rounds" className="mono-label inline-flex items-center gap-1 text-primary hover:underline">
                {isVi ? "Tất cả vòng" : "All rounds"} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {roundsPending && rounds.length === 0 ? (
              <div className={gridClass}>
                <Skeleton className="h-60" /><Skeleton className="h-60" /><Skeleton className="h-60" />
              </div>
            ) : rounds.length === 0 ? (
              <p className="border border-dashed border-line p-4 text-sm text-muted">
                {isVi ? "Chưa có vòng tài trợ nào." : "No funding rounds yet."}
              </p>
            ) : (
              <div className={gridClass}>
                {rounds.map(({ address, index, data }) => <RoundCard key={address} round={data} roundIndex={index} />)}
              </div>
            )}
          </div>
        </section>
      )}
      <section id="projects-list" className="chain-lattice-host scroll-mt-20">
        <div className={`${sectionContentClass} pb-10 pt-5 sm:pb-12 lg:pb-14`}>
          <div data-aos="fade-up" data-aos-duration="600">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{isVi ? "Dự án nổi bật" : "Featured projects"}</h2>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {isVi ? "Xếp theo số người ủng hộ, sau đó theo số tiền đã nhận." : "Ranked by supporters, then by amount raised."}
            </p>
          </div>
          {projectsPending ? (
            <div className={gridClass}>
              <Skeleton className="h-80" /><Skeleton className="h-80" /><Skeleton className="h-80" />
            </div>
          ) : featuredProjects.length > 0 ? (
            <div className={gridClass}>
              {featuredProjects.map(({ project, address, canDonate }, index) => (
                <ProjectCard
                  key={`${address}:${project.id}`}
                  project={{ ...project, rank: index + 1 }}
                  roundId={address}
                  roundAddress={address}
                  canDonate={canDonate}
                />
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-line p-4 text-sm text-muted">
              {projectsFailed ? (isVi ? "Chưa tải được dự án nổi bật." : "Featured projects could not be loaded.") : t.homeIntro.noProjectsTitle}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

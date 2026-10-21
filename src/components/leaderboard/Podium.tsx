"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { SupporterMarks } from "@/components/project/SupporterMarks";
import { AnimatedNumber, InfoTooltip } from "./Primitives";
import { MatchingMetric, RankBadge, TotalMetric } from "./ProjectMetrics";
import { Stat, StatGroup } from "@/components/common/Stat";
import type { RankedProject } from "./model";

export function Podium({ projects, roundId, pool, finalized }: { projects: RankedProject[]; roundId: string; pool: number; finalized: boolean }) {
  const { t } = useLocale();
  const top = projects.slice(0, 3);
  const maxSupporters = Math.max(0, ...top.map(project => project.supporterCount));
  const markScale = maxSupporters <= 25 ? 1 : Math.max(5, Math.ceil(maxSupporters / 36 / 5) * 5);
  if (!top.length) return null;
  return (
    <section className="hidden min-w-0 lg:block" aria-label={t.competition.topProjects}>
      <div className={`mx-auto grid max-w-6xl items-end gap-4 ${top.length === 1 ? "max-w-md grid-cols-1" : top.length === 2 ? "max-w-3xl grid-cols-2" : "grid-cols-3"}`}>
        {top.map((project, index) => (
          <article
            key={project.id}
            data-zero={project.supporterCount === 0}
            className={`relative min-w-0 bg-surface p-6 ${project.supporterRank === 1 ? "gradient-border pt-9" : "border border-line"} ${top.length === 3 ? index === 0 ? "lg:order-2" : index === 1 ? "lg:order-1" : "lg:order-3" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <RankBadge project={project} large />
              <span className="role-label">{t.competition.rank}</span>
            </div>
            <div className="mt-5 flex min-w-0 items-start gap-1">
              <h3 className="min-h-12 min-w-0 flex-1 text-lg font-semibold leading-6">
                <Link href={`/round/${roundId}/project/${project.id}`} title={project.name} className="competition-focus line-clamp-2 hover:text-primary">
                  {project.name}
                </Link>
              </h3>
              {project.name.length > 40 && <InfoTooltip label={project.name}>{project.name}</InfoTooltip>}
            </div>

            {/* Single hero metric on podium: value-lg (32px) */}
            <div className="mt-5">
              <p className="role-label text-muted">{t.competition.supporters}</p>
              <div className={`mt-1 font-bold ${project.supporterCount ? "value-lg text-primary" : "value-lg text-muted"}`}>
                <AnimatedNumber value={project.supporterCount} decimals={0} />
              </div>
            </div>

            <SupporterMarks count={project.supporterCount} marksOnly scale={markScale} className="mt-3" />

            <StatGroup columns={2} className="mt-5">
              <Stat
                label={t.competition.direct}
                value={<AnimatedNumber value={project.totalDonated} decimals={2} />}
                unit={t.competition.currency}
                tone="default"
              />
              <Stat
                label={t.competition.matching}
                value={<MatchingMetric project={project} finalized={finalized} pool={pool} bar={false} />}
                unit={t.competition.currency}
                tone="money"
              />
            </StatGroup>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <span className="role-label">{t.competition.total}</span>
              <div className="flex items-baseline gap-1 text-foreground font-semibold">
                <TotalMetric project={project} finalized={finalized} />
                <span className="role-unit">{t.competition.currency}</span>
              </div>
            </div>

            <Link href={`/round/${roundId}/project/${project.id}`} className="competition-focus mt-4 flex min-h-10 items-center justify-between text-xs text-primary hover:underline hover:text-primary-hover cursor-pointer transition-colors active:scale-[0.99]">
              <span>{t.competition.viewProject}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

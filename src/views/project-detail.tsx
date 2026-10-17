"use client";
import { RoundCancellationPanel } from "@/components/round/RoundCancellationPanel";

import { AOSInit } from "@/components/common/AOSInit";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Address } from "viem";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { DonateBox } from "@/components/project/DonateBox";
import { SupporterMarks } from "@/components/project/SupporterMarks";
import { ProjectDetailSkeleton } from "@/components/common/PageSkeletons";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { formatUsdc, formatUsdcFixed, shortAddress } from "@/lib/format";
import { Stat, StatGroup } from "@/components/common/Stat";
import { fmt } from "@/lib/copy";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  BookOpen,
  Cpu,
  Leaf,
  Music,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export function ProjectDetailView() {
  const params = useParams();
  const rawRoundId = (params?.id as string) || "";
  const projectId = (params?.projectId as string) || "1";
  const customRoundAddress = rawRoundId.startsWith("0x") ? (rawRoundId as Address) : undefined;

  const { t } = useLocale();
  const { roundAddress, isLoading: isRoundLoading, isError: isRoundError } = useRound(customRoundAddress);
  const { projects, isLoading: isProjectsLoading, isError: isProjectsError, refetch } = useProjects(roundAddress);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const project = useMemo(() => {
    return projects.find((p) => p.id === projectId || p.contractId?.toString() === projectId);
  }, [projects, projectId]);

  if (isRoundLoading || isProjectsLoading) {
    return (
      <Container className="py-8 sm:py-10">
        <ProjectDetailSkeleton />
      </Container>
    );
  }

  if (isRoundError || isProjectsError || !project) {
    return (
      <Container className="py-12">
        <ErrorState
          title={t.projectDetail.projectNotFound}
          reason={fmt(t.projectDetail.projectNotFoundReason, { id: projectId })}
          onRetry={() => refetch()}
        />
      </Container>
    );
  }

  const CategoryIcon = {
    education: BookOpen,
    technology: Cpu,
    environment: Leaf,
    arts: Music,
  }[project.category] || Sparkles;

  const categoryLabel = t.categories[project.category as keyof typeof t.categories] ?? project.category;

  return (
    <Container className="py-8 sm:py-10 space-y-8 pb-24 lg:pb-8">
      <RoundCancellationPanel roundAddress={roundAddress} />
      <AOSInit />
      {/* Back Link */}
      <div>
        <Link
          href={roundAddress ? `/round/${roundAddress}` : "/"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.projectDetail.backToRound}</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Project Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Card */}
          <div
            className="border border-line bg-surface p-6 space-y-4"
            data-aos="fade-right"
            data-aos-duration="600"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {project.rank && (
                  <Badge variant="primary" className="font-mono font-bold text-xs">
                    {fmt(t.projectDetail.rankBadge, { rank: project.rank })}
                  </Badge>
                )}
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <CategoryIcon className="h-3.5 w-3.5 text-muted" />
                  <span>{categoryLabel}</span>
                </span>
              </div>

              {!project.approved && (
                <Badge variant="warning">{t.myActivity.statusPending}</Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {project.name}
            </h1>

            <p className="text-sm text-muted leading-relaxed">
              {project.description}
            </p>

            {/* Quick Metrics */}
            <StatGroup columns={3} className="my-4">
              <Stat
                label={t.projectCard.directDonations}
                value={formatUsdcFixed(project.totalDonated, { includeSymbol: false })}
                unit="USDC"
                tone="default"
                title={formatUsdc(project.totalDonated)}
              />
              <Stat
                label={t.projectCard.matchingEstimated}
                value={formatUsdcFixed(project.estimatedMatching, { includeSymbol: false })}
                unit="USDC"
                tone="money"
                title={formatUsdc(project.estimatedMatching)}
              />
              <Stat
                label={t.projectDetail.ownerShort}
                value={shortAddress(project.ownerAddress, 5)}
                tone="default"
                title={project.ownerAddress}
              />
            </StatGroup>
          </div>

          {/* Supporter Marks Breakdown */}
          <div
            className="border border-line bg-surface p-6 space-y-3"
            data-aos="fade-right"
            data-aos-delay="100"
            data-aos-duration="600"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {t.projectDetail.qfLessonTitle}
            </h2>
            <SupporterMarks count={project.supporterCount} maxMarks={72} scale={3} />
            <p className="text-xs text-muted leading-relaxed">
              {t.projectDetail.qfLessonPre}
              <strong>{t.projectDetail.qfLessonBold}</strong>
              {t.projectDetail.qfLessonPost}
            </p>
          </div>

          {/* Project proposal info & Contact link */}
          <div
            className="border border-line bg-surface p-6 space-y-4"
            data-aos="fade-right"
            data-aos-delay="200"
            data-aos-duration="600"
          >
            <h2 className="text-base font-bold text-foreground">
              {t.projectDetail.aboutTitle}
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed whitespace-pre-line">
              {project.description}
            </p>

            {project.contactUrl && (
              <div className="pt-2">
                <a
                  href={project.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono-label inline-flex items-center gap-1.5 border border-line bg-surface-2 px-3 py-2 text-xs text-muted hover:border-primary hover:text-foreground"
                >
                  <span>{t.projectDetail.visitWebsite}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Sticky Donate Box for Desktop */}
        <div
          className="hidden lg:block lg:col-span-5 sticky top-24"
          data-aos="fade-left"
          data-aos-duration="700"
        >
          <DonateBox project={project} roundAddress={roundAddress} />
        </div>
      </div>

      {/* Mobile Floating Drawer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line-strong bg-surface p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="role-label block text-muted">
              {t.projectCard.matchingEstimated}
            </span>
            <span className="role-value-md text-money block">
              {formatUsdcFixed(project.estimatedMatching)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="flex items-center gap-1.5 border border-primary bg-primary px-4 py-2 text-xs font-bold text-foreground"
          >
            <span>{mobileDrawerOpen ? t.projectDetail.closeDrawer : t.donateBox.title}</span>
            {mobileDrawerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {mobileDrawerOpen && (
          <div className="mt-4 pt-4 border-t border-line max-h-[75vh] overflow-y-auto">
            <DonateBox project={project} roundAddress={roundAddress} />
          </div>
        )}
      </div>
    </Container>
  );
}

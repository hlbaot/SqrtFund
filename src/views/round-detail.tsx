"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Address } from "viem";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { CountdownTimer } from "@/components/round/CountdownTimer";
import { PoolStats } from "@/components/round/PoolStats";
import { ProjectCard } from "@/components/project/ProjectCard";
import { RoundDetailSkeleton } from "@/components/common/PageSkeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { shortAddress } from "@/lib/format";
import { ArrowLeft, Check, Copy, Search } from "lucide-react";

type SortOption = "matching" | "supporters" | "newest";

export function RoundDetailView() {
  const router = useRouter();
  const params = useParams();
  const rawId = (params?.id as string) || "";
  const customAddress = rawId.startsWith("0x") ? (rawId as Address) : undefined;

  const { t } = useLocale();
  const {
    roundAddress,
    allRounds,
    admin,
    name,
    organizer,
    pool,
    endTime,
    status,
    isLoading: isRoundLoading,
    isError: isRoundError,
    refetch: refetchRound,
  } = useRound(customAddress);
  const {
    projects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    refetch: refetchProjects,
  } = useProjects(roundAddress);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("matching");
  const [copied, setCopied] = useState(false);

  const roundIndex = useMemo(() => {
    if (!roundAddress || !allRounds || allRounds.length === 0) return 1;
    const idx = allRounds.indexOf(roundAddress);
    return idx !== -1 ? idx + 1 : allRounds.length;
  }, [roundAddress, allRounds]);

  const approvedProjects = useMemo(() => {
    return projects.filter((p) => p.approved);
  }, [projects]);

  const totalDirectDonated = useMemo(() => {
    return approvedProjects.reduce((acc, p) => acc + p.totalDonated, 0);
  }, [approvedProjects]);

  const totalSupporters = useMemo(() => {
    return approvedProjects.reduce((acc, p) => acc + p.supporterCount, 0);
  }, [approvedProjects]);

  const poolUsdc = Number(pool) / 1_000_000;

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    return approvedProjects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [approvedProjects, searchQuery, categoryFilter]);

  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    if (sortBy === "matching") {
      return list.sort((a, b) => b.estimatedMatching - a.estimatedMatching);
    }
    if (sortBy === "supporters") {
      return list.sort((a, b) => b.supporterCount - a.supporterCount);
    }
    return list.sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredProjects, sortBy]);

  if (isRoundLoading || isProjectsLoading) {
    return (
      <Container className="py-8 sm:py-10">
        <RoundDetailSkeleton />
      </Container>
    );
  }

  if (isRoundError || isProjectsError) {
    return (
      <Container className="py-12">
        <ErrorState
          title={t.homeIntro.errorTitle}
          reason={t.homeIntro.errorReason}
          solution={t.homeIntro.errorSolution}
          onRetry={() => {
            refetchRound();
            refetchProjects();
          }}
        />
      </Container>
    );
  }

  if (!roundAddress) {
    return (
      <Container className="py-12">
        <EmptyState
          title="Round not found"
          description="The requested quadratic round does not exist on Avalanche Fuji."
          actionLabel="Back to Home"
          onAction={() => router.push("/")}
        />
      </Container>
    );
  }

  const handleCopyAdmin = () => {
    if (admin) {
      navigator.clipboard.writeText(admin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Container className="py-8 sm:py-10 space-y-8">
      {/* Back Link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.roundDetail.backToRounds}</span>
        </Link>
      </div>

      {/* Round Header Card */}
      <div
        className="border border-line bg-surface p-6 lg:p-8 space-y-6"
        data-aos="fade-down"
        data-aos-duration="600"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-line pb-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={status === "open" ? "primary" : "secondary"}>
                {status === "open"
                  ? t.roundCard.statusOpen
                  : status === "closed"
                  ? t.roundCard.statusClosed
                  : t.roundCard.statusFinalized}
              </Badge>

              {admin && (
                <div className="mono-label flex items-center gap-1.5 border border-line bg-bg px-2.5 py-1 text-xs">
                  <span className="text-muted">{t.homeIntro.roundAdminLabel}:</span>
                  <span className="tabular-mono text-foreground">{shortAddress(admin)}</span>
                  <button
                    type="button"
                    onClick={handleCopyAdmin}
                    className="ml-0.5 text-muted hover:text-foreground focus:outline-none"
                    title={copied ? t.homeIntro.copied : t.common.copyAddress}
                    aria-label={t.common.copyAddress}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-money" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {name?.trim()
                ? name.trim()
                : `${t.homeIntro.roundTitle} #${roundIndex} · ${shortAddress(roundAddress)}`}
            </h1>
            {organizer?.trim() ? (
              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
                {organizer.trim()}
              </p>
            ) : null}
          </div>

          <div className="shrink-0">
            {endTime && <CountdownTimer endTime={endTime} statusOverride={status} prominent />}
          </div>
        </div>

        {/* Aggregate Pool Stats */}
        <PoolStats
          matchingPool={poolUsdc}
          totalDonated={totalDirectDonated}
          totalSupporters={totalSupporters}
          projectCount={approvedProjects.length}
        />
      </div>

      {/* Filter and Search Bar */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-line pb-4"
        data-aos="fade-up"
        data-aos-duration="500"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder={t.roundDetail.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-line-strong bg-bg pl-9 pr-4 py-2 text-xs font-medium text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-line-strong bg-bg px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="technology">Technology</option>
            <option value="education">Education</option>
            <option value="environment">Environment</option>
            <option value="arts">Arts</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="border border-line-strong bg-bg px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            <option value="matching">{t.roundDetail.sortMatching}</option>
            <option value="supporters">{t.roundDetail.sortSupporters}</option>
            <option value="newest">{t.roundDetail.sortNewest}</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {sortedProjects.length === 0 ? (
        <EmptyState
          title={t.roundDetail.noProjects}
          description={t.roundDetail.noProjectsDesc}
          actionLabel="Clear search filters"
          onAction={() => {
            setSearchQuery("");
            setCategoryFilter("all");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProjects.map((project, index) => (
            <div
              key={project.id}
              data-aos="fade-up"
              data-aos-delay={(index % 6) * 80}
              data-aos-duration="600"
            >
              <ProjectCard
                project={{
                  ...project,
                  rank: index + 1,
                }}
                roundId={roundAddress}
              />
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}

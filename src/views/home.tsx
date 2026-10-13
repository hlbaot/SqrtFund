"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { formatUsdc, formatNumber } from "@/lib/format";
import { RoundCard } from "@/components/round/RoundCard";
import { ProjectCard } from "@/components/project/ProjectCard";
import { SupporterMarks } from "@/components/project/SupporterMarks";
import { HomeSkeleton } from "@/components/common/PageSkeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Frame } from "@/components/ui/Frame";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { MonoLabel } from "@/components/ui/MonoLabel";
import type { Round } from "@/types";
import { ArrowRight, Coins, Users, Rocket } from "lucide-react";

export function HomeView() {
  const router = useRouter();
  const { t } = useLocale();
  const { isAdmin } = useRole();
  const {
    roundAddress,
    pool,
    startTime,
    endTime,
    status,
    isLoading: isRoundLoading,
    isError: isRoundError,
    refetch: refetchRound,
  } = useRound();
  const { projects, isLoading: isProjectsLoading, isError: isProjectsError, refetch: refetchProjects } = useProjects();
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const sectionIds = ["intro", "round", "how-it-works", "projects-list"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
    );

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  // Filter approved projects and sort strictly by ESTIMATED MATCHING descending
  const approvedProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p.approved)
      .sort((a, b) => b.estimatedMatching - a.estimatedMatching);
  }, [projects]);

  const totalDirectDonated = useMemo(() => {
    return approvedProjects.reduce((acc, p) => acc + p.totalDonated, 0);
  }, [approvedProjects]);

  const totalSupporters = useMemo(() => {
    return approvedProjects.reduce((acc, p) => acc + p.supporterCount, 0);
  }, [approvedProjects]);

  const poolUsdc = Number(pool) / 1_000_000;

  // Active round object formatted for RoundCard
  const activeRound: Round | null = useMemo(() => {
    if (!roundAddress) return null;
    return {
      id: roundAddress,
      title: "UniHack Autumn Quadratic Round",
      description: "Sponsor matching pool supporting student clubs and university builder initiatives on Avalanche Fuji.",
      matchingPool: poolUsdc,
      totalDonated: totalDirectDonated,
      totalSupporters,
      projectCount: approvedProjects.length,
      startTime: startTime ? new Date(Number(startTime) * 1000).toISOString() : new Date().toISOString(),
      endTime: endTime ? new Date(Number(endTime) * 1000).toISOString() : new Date().toISOString(),
      status,
      sponsorName: "Avalanche & UniHack Foundation",
    };
  }, [roundAddress, poolUsdc, totalDirectDonated, totalSupporters, approvedProjects.length, startTime, endTime, status]);

  if (isRoundLoading || isProjectsLoading) {
    return <HomeSkeleton />;
  }

  if (isRoundError || isProjectsError) {
    return (
      <ErrorState
        title="Failed to retrieve quadratic funding round"
        reason="RPC connection timed out while querying contract data on Avalanche Fuji."
        solution="Verify your RPC connection and click below to retry."
        onRetry={() => {
          refetchRound();
          refetchProjects();
        }}
      />
    );
  }

  // If no round deployed yet
  if (!roundAddress || !activeRound) {
    return (
      <div className="space-y-8 py-12">
        <EmptyState
          title="No active quadratic rounds"
          description="There are currently no funding rounds deployed on Avalanche Fuji. If you are the admin, deploy the first round now."
          actionLabel={isAdmin ? "Create Round (Admin)" : "Register a student club"}
          onAction={() => router.push(isAdmin ? "/admin" : "/register")}
        />
      </div>
    );
  }

  const sideNav = [
    { id: "intro", label: "Intro" },
    { id: "round", label: "Stats" },
    { id: "how-it-works", label: "Flow" },
    { id: "projects-list", label: "Projects" },
  ];

  return (
    <div className="relative space-y-0">
      <nav
        aria-label="Page sections"
        className="fixed right-[max(1.5rem,calc((100vw-72rem)/2-4rem))] top-1/2 z-20 hidden -translate-y-1/2 lg:block"
      >
        <div className="flex flex-col items-center gap-3 border border-line bg-bg/80 px-2 py-3 backdrop-blur-md">
          {sideNav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`group relative h-2.5 w-2.5 border transition-colors ${
                activeSection === item.id
                  ? "border-primary bg-primary"
                  : "border-line-strong bg-surface hover:border-primary"
              }`}
            >
              <span className="sr-only">{item.label}</span>
              <span className="mono-label pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 whitespace-nowrap border border-line bg-bg px-2 py-1 text-muted group-hover:block">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </nav>

      <section id="intro" className="grid gap-8 border-b border-line pb-10 pt-2 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <MonoLabel className="text-primary">Student-led funding</MonoLabel>
          <h1 className="max-w-5xl text-4xl font-bold leading-[0.94] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
            Many students decide which{" "}
            <GradientBorder className="inline-block bg-surface px-3 py-1 align-baseline">
              projects
            </GradientBorder>{" "}
            get funded
          </h1>

          <p className="max-w-2xl text-base leading-8 text-muted sm:text-lg">
            {t.hero.subline}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#projects-list"
              className="gradient-border mono-label inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-foreground transition-colors hover:bg-surface-2 focus:outline-none"
            >
              <span>{t.hero.primaryCta}</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <Link
              href="/register"
              className="mono-label inline-flex min-h-11 items-center gap-2 border border-line-strong bg-surface px-5 py-2.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus:outline-none"
            >
              <span>{t.hero.secondaryCta}</span>
            </Link>
          </div>
          <div className="mono-label flex items-center gap-3 text-muted">
            <span className="h-px w-12 bg-line-strong" />
            <span>Scroll</span>
            <span aria-hidden="true">↓</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_12rem]">
          <Frame className="p-5" interactive>
            <div className="mb-4 flex items-center justify-between">
              <MonoLabel>Supporter signal</MonoLabel>
              <span className="terminal-caret mono-label text-money">
                Estimating matching
              </span>
            </div>
            <SupporterMarks
              count={totalSupporters}
              maxMarks={144}
              scale={2}
              compact
              className="border-0 bg-transparent p-0"
            />
          </Frame>

          <Frame className="p-0">
            {[
              "Transparent matching",
              "One student one voice",
              "Open to verify",
              "Low fees on Avalanche",
            ].map((row) => (
              <div
                key={row}
                className="mono-label flex items-center gap-2 border-b border-line px-4 py-4 text-muted last:border-b-0"
              >
                <span className="text-primary">◂</span>
                <span>{row}</span>
              </div>
            ))}
          </Frame>
        </div>
      </section>

      <section
        aria-label="Platform summary statistics"
        id="round"
        className="grid grid-cols-1 border-b border-line py-6 sm:grid-cols-3"
      >
        <Frame className="border-r-0 p-5">
          <div className="mono-label flex items-center gap-2 text-money">
            <Coins className="h-4 w-4" />
            <span>{t.hero.statPool}</span>
          </div>
          <div className="tabular-mono mt-2 text-3xl font-black text-money">
            {formatUsdc(poolUsdc)}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Sponsored by Avalanche & UniHack Foundation
          </p>
        </Frame>

        <Frame className="border-r-0 p-5">
          <div className="mono-label flex items-center gap-2 text-primary">
            <Users className="h-4 w-4" />
            <span>{t.hero.statSupporters}</span>
          </div>
          <div className="tabular-mono mt-2 text-3xl font-black text-foreground">
            {formatNumber(totalSupporters)}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Verified university student participants
          </p>
        </Frame>

        <Frame className="p-5">
          <div className="mono-label flex items-center gap-2 text-muted">
            <Rocket className="h-4 w-4" />
            <span>{t.hero.statProjects}</span>
          </div>
          <div className="tabular-mono mt-2 text-3xl font-black text-foreground">
            {formatNumber(approvedProjects.length)}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Approved student clubs receiving matching
          </p>
        </Frame>
      </section>

      <section id="how-it-works" className="space-y-6 border-b border-line py-10">
        <div>
          <MonoLabel>{t.howItWorks.title}</MonoLabel>
          <h2 className="mt-2 text-2xl font-bold text-foreground tracking-tight">
            {t.howItWorks.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t.howItWorks.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
          <Frame className="p-4" interactive>
            <span className="mono-label text-primary">Step 01</span>
            <h3 className="mt-2 text-sm font-bold text-foreground">
              {t.howItWorks.step1Title}
            </h3>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              {t.howItWorks.step1Desc}
            </p>
          </Frame>

          <Frame className="p-4" interactive>
            <span className="mono-label text-primary">Step 02</span>
            <h3 className="mt-2 text-sm font-bold text-foreground">
              {t.howItWorks.step2Title}
            </h3>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              {t.howItWorks.step2Desc}
            </p>
          </Frame>

          <Frame className="p-4" interactive>
            <span className="mono-label text-money">Step 03</span>
            <h3 className="mt-2 text-sm font-bold text-foreground">
              {t.howItWorks.step3Title}
            </h3>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              {t.howItWorks.step3Desc}
            </p>
          </Frame>
        </div>
      </section>

      <section className="space-y-4 border-b border-line py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t.roundCard.openTitle}
          </h2>
          <span className="mono-label text-muted">Active QF Round</span>
        </div>
        <RoundCard round={activeRound} />
      </section>

      <section id="projects-list" className="space-y-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-line pb-4">
          <div>
            <MonoLabel>Projects</MonoLabel>
            <h2 className="mt-2 text-xl font-bold text-foreground tracking-tight">
              Featured Projects in Current Round
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              Ranked by <strong className="text-money">estimated matching funds</strong>, not donation totals.
            </p>
          </div>
          <div className="mono-label flex items-center gap-2 text-muted">
            <span className="inline-block h-2 w-2 bg-money" />
            <span>Quadratic formula active</span>
          </div>
        </div>

        {approvedProjects.length === 0 ? (
          <div className="border border-line bg-surface p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-foreground">No approved projects yet</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Student projects are currently pending review or haven&apos;t registered yet.
            </p>
            <div className="pt-2">
              <Link href="/register">
                <span className="mono-label inline-flex items-center gap-1 border border-primary bg-primary/10 px-4 py-2 text-primary hover:bg-primary hover:text-foreground">
                  Submit a Project Proposal →
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {approvedProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={{
                  ...project,
                  rank: index + 1,
                }}
                roundId={roundAddress}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

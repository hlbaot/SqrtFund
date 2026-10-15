"use client";

import { AOSInit } from "@/components/common/AOSInit";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { formatNumber, formatUsdc } from "@/lib/format";
import { RoundCard } from "@/components/round/RoundCard";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Frame } from "@/components/ui/Frame";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Container } from "@/components/layout/Container";
import type { Round } from "@/types";
import {
  ArrowRight,
  Calculator,
  Coins,
  HandCoins,
  PenLine,
  Rocket,
  Users,
} from "lucide-react";

function QuadraticVisual() {
  const { t } = useLocale();

  // 6 columns with mathematically computed quadratic growth values (y = 178 - 144 * sqrt(x/600))
  // Baseline at y = 195. Height = 195 - y
  const columns = [
    { cx: 50, y: 136, height: 59 },
    { cx: 150, y: 106, height: 89 },
    { cx: 250, y: 85, height: 110 },
    { cx: 350, y: 68, height: 127 },
    { cx: 450, y: 53, height: 142 },
    { cx: 550, y: 40, height: 155 },
  ];

  return (
    <div
      data-aos="fade-left"
      data-aos-duration="800"
      className="flex h-full w-full flex-col justify-center xl:pr-6 2xl:pr-8"
    >
      <Frame className="overflow-hidden p-5 sm:p-6" interactive>
        {/* Header: SQRT SIGNAL / Subtitle / LIVE status badge */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <MonoLabel className="text-primary">{t.homeIntro.visualLabel}</MonoLabel>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {t.homeIntro.visualDescription}
            </p>
          </div>
          <div className="flex items-center gap-1.5 border border-money/40 bg-money/10 px-2.5 py-1 text-xs font-semibold tabular-mono text-money">
            <span className="h-1.5 w-1.5 rounded-full bg-money animate-pulse" />
            <span className="mono-label">{t.homeIntro.visualStatus}</span>
          </div>
        </div>

        {/* Single Unified Chart Area with 0 0 600 240 viewBox */}
        <div className="relative mt-5 w-full aspect-[600/240] min-h-[170px] max-h-[250px] overflow-hidden border border-line bg-bg/80">
          <svg
            viewBox="0 0 600 240"
            preserveAspectRatio="none"
            className="w-full h-full block"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="qf-curve-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--money)" stopOpacity="0.22" />
                <stop offset="85%" stopColor="var(--money)" stopOpacity="0.04" />
                <stop offset="100%" stopColor="var(--money)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Subtle background coordinate grid */}
            {[50, 95, 145, 195].map((y) => (
              <line
                key={`h-${y}`}
                x1={0}
                y1={y}
                x2={600}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
            ))}
            {[100, 200, 300, 400, 500].map((x) => (
              <line
                key={`v-${x}`}
                x1={x}
                y1={0}
                x2={x}
                y2={200}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.4"
              />
            ))}

            {/* Shaded quadratic area under curve */}
            <path
              d="M 0 178 C 40 148 100 118 150 106 C 210 92 290 78 350 68 C 420 57 510 43 600 34 L 600 195 L 0 195 Z"
              fill="url(#qf-curve-grad)"
            />

            {/* 6 Column Bars, vertical guidelines, baseline segments and centered red dots */}
            {columns.map((col, idx) => (
              <g key={col.cx}>
                {/* Vertical guideline from dot up to curve */}
                <line
                  x1={col.cx}
                  y1={col.y}
                  x2={col.cx}
                  y2={206}
                  stroke="var(--money)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  opacity="0.3"
                />

                {/* Vertical column bar aligned with the curve top */}
                <rect
                  x={col.cx - 26}
                  y={col.y}
                  width={52}
                  height={col.height}
                  fill="var(--money)"
                  fillOpacity="0.12"
                  stroke="var(--money)"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  className="qf-bar"
                  style={{ animationDelay: `${idx * 120}ms` }}
                />

                {/* Baseline segment at y = 195 */}
                <line
                  x1={col.cx - 30}
                  y1={195}
                  x2={col.cx + 30}
                  y2={195}
                  stroke="var(--money)"
                  strokeWidth="2.5"
                  strokeLinecap="square"
                />

                {/* Centered red dot directly below baseline */}
                <rect
                  x={col.cx - 3}
                  y={210}
                  width={6}
                  height={6}
                  fill="var(--primary)"
                />
              </g>
            ))}

            {/* Red accent glow under main curve */}
            <path
              d="M 0 178 C 40 148 100 118 150 106 C 210 92 290 78 350 68 C 420 57 510 43 600 34"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="6"
              strokeOpacity="0.14"
            />

            {/* Quadratic growth curve: starts at left edge (0, 178), ends at right edge (600, 34) */}
            <path
              d="M 0 178 C 40 148 100 118 150 106 C 210 92 290 78 350 68 C 420 57 510 43 600 34"
              fill="none"
              stroke="var(--money)"
              strokeWidth="2.5"
              strokeLinecap="square"
              className="qf-curve"
            />

            {/* End point on curve */}
            <circle cx={600} cy={34} r={3.5} fill="var(--money)" />
          </svg>
        </div>

        {/* Bottom row: three equal boxes with clear labels */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
          {[t.homeIntro.visualOne, t.homeIntro.visualRoot, t.homeIntro.visualMatch].map((label) => (
            <div
              key={label}
              className="flex min-h-[44px] items-center justify-center border border-line bg-surface/90 px-2 py-2"
            >
              <span className="mono-label text-xs font-bold tracking-wider text-muted whitespace-nowrap">
                {label}
              </span>
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}

export function HomeView() {
  const router = useRouter();
  const { t } = useLocale();
  const { isAdmin } = useRole();
  const {
    roundAddress,
    allRounds,
    admin,
    name: roundName,
    organizer: roundOrganizer,
    pool,
    startTime,
    endTime,
    status,
    isLoading: isRoundLoading,
    isError: isRoundError,
    refetch: refetchRound,
  } = useRound();
  const {
    projects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    refetch: refetchProjects,
  } = useProjects();
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const sectionIds = ["intro", "stats", "how-it-works", "current-round", "projects-list"];
    let frame: number | null = null;

    const updateActiveSection = () => {
      frame = null;
      if (document.documentElement.classList.contains("splash-active")) return;
      const sections = sectionIds.flatMap(id => {
        const element = document.getElementById(id);
        return element && element.getClientRects().length ? [{ id, element }] : [];
      });
      const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const scrollMargin = Math.max(0, ...sections.map(({ element }) => parseFloat(getComputedStyle(element).scrollMarginTop) || 0));
      // Match anchor scrolling too: scroll-padding and scroll-margin are additive.
      const activationLine = Math.max(Math.max(0, headerBottom) + 48, scrollPadding + scrollMargin + 1);
      let nextActive = sections[0]?.id ?? "intro";

      for (const section of sections) {
        // offsetTop is relative to an offset parent, not the scroll document.
        if (section.element.getBoundingClientRect().top <= activationLine) nextActive = section.id;
      }
      if (window.scrollY > 0 && document.documentElement.scrollHeight > window.innerHeight + 1 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        nextActive = sections.at(-1)?.id ?? nextActive;
      }
      setActiveSection(nextActive);
    };

    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateActiveSection);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    if (pageRef.current) observer.observe(pageRef.current);
    const header = document.querySelector("header");
    if (header) observer.observe(header);
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("splash-intro-finished", scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("splash-intro-finished", scheduleUpdate);
    };
  }, []);

  const isLoading = isRoundLoading || isProjectsLoading;
  const hasError = isRoundError || isProjectsError;

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

  const roundIndex = useMemo(() => {
    if (!roundAddress || !allRounds || allRounds.length === 0) return 1;
    const idx = allRounds.indexOf(roundAddress);
    return idx !== -1 ? idx + 1 : allRounds.length;
  }, [roundAddress, allRounds]);

  const activeRound: Round | null = useMemo(() => {
    if (!roundAddress) return null;
    return {
      id: roundAddress,
      title: roundName?.trim() ? roundName.trim() : `${t.homeIntro.roundTitle} #${roundIndex}`,
      description: roundOrganizer?.trim() || "",
      name: roundName,
      organizer: roundOrganizer,
      matchingPool: poolUsdc,
      totalDonated: totalDirectDonated,
      totalSupporters,
      projectCount: approvedProjects.length,
      startTime: startTime
        ? new Date(Number(startTime) * 1000).toISOString()
        : new Date().toISOString(),
      endTime: endTime ? new Date(Number(endTime) * 1000).toISOString() : new Date().toISOString(),
      status,
      sponsorName: roundOrganizer?.trim() || "",
    };
  }, [
    roundAddress,
    roundIndex,
    roundName,
    roundOrganizer,
    poolUsdc,
    totalDirectDonated,
    totalSupporters,
    approvedProjects.length,
    startTime,
    endTime,
    status,
    t.homeIntro.roundTitle,
  ]);

  const sideNav = [
    { id: "intro", label: t.homeIntro.sideIntro },
    { id: "stats", label: t.homeIntro.sideStats },
    { id: "how-it-works", label: t.homeIntro.sideFlow },
    { id: "current-round", label: t.roundCard.openTitle },
    { id: "projects-list", label: t.homeIntro.sideProjects },
  ];

  const steps = [
    {
      icon: PenLine,
      step: "01",
      title: t.homeIntro.step1Title,
      description: t.homeIntro.step1Desc,
      tone: "text-primary",
    },
    {
      icon: HandCoins,
      step: "02",
      title: t.homeIntro.step2Title,
      description: t.homeIntro.step2Desc,
      tone: "text-money",
    },
    {
      icon: Calculator,
      step: "03",
      title: t.homeIntro.step3Title,
      description: t.homeIntro.step3Desc,
      tone: "text-primary",
    },
  ];

  return (
    <div ref={pageRef} className="relative space-y-0">
      <AOSInit />
      {/* Side dot navigation: visible only from xl (1280px+) screens where safe right margins exist */}
      <nav
        aria-label={t.homeIntro.sectionNavLabel}
        className="fixed right-3 xl:right-4 2xl:right-6 top-1/2 z-20 hidden -translate-y-1/2 xl:block"
      >
        <div className="flex flex-col items-center gap-3 border border-line bg-bg/90 p-2 backdrop-blur-md">
          {sideNav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                const target = document.getElementById(item.id);
                if (target) {
                  target.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className={`group relative h-2.5 w-2.5 border transition-colors ${
                activeSection === item.id
                  ? "border-primary bg-primary"
                  : "border-line-strong bg-surface hover:border-primary"
              }`}
              aria-current={activeSection === item.id ? "true" : undefined}
            >
              <span className="sr-only">{item.label}</span>
              <span className="mono-label pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 whitespace-nowrap border border-line bg-bg px-2 py-1 text-muted shadow-md group-hover:block">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </nav>

      {/* 1. Hero Section: 2 columns from 1024px up, min-height: min(78svh, 720px), no step cards */}
      <section id="intro" className="scroll-mt-20 border-b border-line">
        <Container className="flex min-h-[min(78svh,720px)] flex-col justify-center py-[clamp(3rem,6vw,6rem)]">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
            <div className="space-y-6" data-aos="fade-right" data-aos-duration="800">
              <MonoLabel className="text-primary">{t.homeIntro.eyebrow}</MonoLabel>

              <h1 className="hero-headline font-bold text-foreground max-w-2xl">
                {t.homeIntro.headlineStart}{" "}
                <GradientBorder className="inline-block bg-surface px-3 py-1 align-baseline">
                  {t.homeIntro.headlineAccent}
                </GradientBorder>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                {t.homeIntro.subheadline}
              </p>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <a
                  href="#current-round"
                  className="gradient-border mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 px-6 py-2.5 text-foreground focus:outline-none sm:w-auto"
                >
                  <span>{t.homeIntro.primaryCta}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <Link
                  href="/register"
                  className="mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 border border-line-strong bg-surface px-6 py-2.5 text-muted transition-colors hover:text-foreground focus:outline-none sm:w-auto"
                >
                  <Rocket className="h-4 w-4" />
                  <span>{t.homeIntro.secondaryCta}</span>
                </Link>
              </div>
            </div>

            <QuadraticVisual />
          </div>
        </Container>
      </section>

      {/* 2. Stats strip: 3 stats in 1 row, full container width, big mono numbers, short captions */}
      <section
        id="stats"
        aria-label={t.homeIntro.statsAria}
        className="scroll-mt-20 border-b border-line"
      >
        <Container className="py-[clamp(3rem,6vw,6rem)]">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : !roundAddress ? (
            <div className="border border-line bg-surface p-6">
              <MonoLabel className="text-primary">{t.homeIntro.noRoundTitle}</MonoLabel>
              <p className="mt-2 max-w-xl text-sm text-muted">{t.homeIntro.noRoundDesc}</p>
              <button
                type="button"
                onClick={() => router.push(isAdmin ? "/admin" : "/register")}
                className="mono-label mt-4 inline-flex min-h-11 items-center border border-primary bg-primary/10 px-5 py-2 text-primary hover:bg-primary hover:text-foreground"
              >
                {isAdmin ? t.homeIntro.createRoundCta : t.homeIntro.registerFallbackCta}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
              <Frame
                className="p-6"
                data-aos="fade-up"
                data-aos-delay="0"
                data-aos-duration="600"
              >
                <div className="mono-label flex items-center gap-2 text-money">
                  <Coins className="h-4 w-4" />
                  <span>{t.hero.statPool}</span>
                </div>
                <div className="tabular-mono mt-3 text-3xl font-black text-money lg:text-4xl">
                  {formatUsdc(poolUsdc)}
                </div>
                {t.homeIntro.poolNote && (
                  <p className="mt-1 text-xs text-muted">{t.homeIntro.poolNote}</p>
                )}
              </Frame>

              <Frame
                className="p-6"
                data-aos="fade-up"
                data-aos-delay="100"
                data-aos-duration="600"
              >
                <div className="mono-label flex items-center gap-2 text-primary">
                  <Users className="h-4 w-4" />
                  <span>{t.hero.statSupporters}</span>
                </div>
                <div className="tabular-mono mt-3 text-3xl font-black text-foreground lg:text-4xl">
                  {formatNumber(totalSupporters)}
                </div>
                {t.homeIntro.supportersNote && (
                  <p className="mt-1 text-xs text-muted">{t.homeIntro.supportersNote}</p>
                )}
              </Frame>

              <Frame
                className="p-6"
                data-aos="fade-up"
                data-aos-delay="200"
                data-aos-duration="600"
              >
                <div className="mono-label flex items-center gap-2 text-muted">
                  <Rocket className="h-4 w-4" />
                  <span>{t.hero.statProjects}</span>
                </div>
                <div className="tabular-mono mt-3 text-3xl font-black text-foreground lg:text-4xl">
                  {formatNumber(approvedProjects.length)}
                </div>
                {t.homeIntro.projectsNote && (
                  <p className="mt-1 text-xs text-muted">{t.homeIntro.projectsNote}</p>
                )}
              </Frame>
            </div>
          )}
        </Container>
      </section>

      {/* 3. How it works: label + title only (no long subtitle), 3 equal columns */}
      <section id="how-it-works" className="scroll-mt-20 border-b border-line">
        <Container className="space-y-8 py-[clamp(3rem,6vw,6rem)]">
          <div data-aos="fade-up" data-aos-duration="600">
            <MonoLabel className="text-primary">{t.howItWorks.title}</MonoLabel>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t.howItWorks.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <Frame
                  key={step.step}
                  className="p-6"
                  interactive
                  data-aos="fade-up"
                  data-aos-delay={idx * 150}
                  data-aos-duration="600"
                >
                  <div className="flex items-center justify-between">
                    <div className={`inline-flex border border-line-strong bg-bg p-2.5 ${step.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`mono-label ${step.tone}`}>
                      {t.homeIntro.stepLabel} {step.step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">{step.description}</p>
                </Frame>
              );
            })}
          </div>
        </Container>
      </section>

      {/* 4. Current round: wide card with dynamic round title, admin copy button, inline stats, responsive CTA */}
      {hasError ? (
        <section className="border-b border-line">
          <Container className="py-[clamp(3rem,6vw,6rem)]" data-aos="fade-up">
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
        </section>
      ) : activeRound ? (
        <section id="current-round" className="scroll-mt-20 border-b border-line">
          <Container className="space-y-6 py-[clamp(3rem,6vw,6rem)]" data-aos="fade-up" data-aos-duration="700">
            <div className="flex items-center justify-between">
              <div>
                <MonoLabel className="text-primary">{t.homeIntro.activeRoundLabel}</MonoLabel>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {t.roundCard.openTitle}
                </h2>
              </div>
            </div>
            <RoundCard
              round={activeRound}
              adminAddress={admin}
              roundIndex={roundIndex}
            />
          </Container>
        </section>
      ) : null}

      {/* 5. Featured projects */}
      <section id="projects-list" className="scroll-mt-20">
        <Container className="space-y-8 py-[clamp(3rem,6vw,6rem)]">
          <div
            className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-end"
            data-aos="fade-up"
            data-aos-duration="600"
          >
            <div>
              <MonoLabel className="text-primary">{t.homeIntro.projectsEyebrow}</MonoLabel>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {t.homeIntro.projectsTitle}
              </h2>
              <p className="mt-1 text-xs text-muted sm:text-sm">{t.homeIntro.projectsSubtitle}</p>
            </div>
            <div className="mono-label flex items-center gap-2 text-muted">
              <span className="inline-block h-2 w-2 bg-money" />
              <span>{t.homeIntro.formulaActive}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          ) : approvedProjects.length === 0 ? (
            <EmptyState
              title={t.homeIntro.noProjectsTitle}
              description={t.homeIntro.noProjectsDesc}
              actionLabel={t.homeIntro.noProjectsCta}
              onAction={() => router.push("/register")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {approvedProjects.map((project, index) => (
                <div
                  key={project.id}
                  data-aos="fade-up"
                  data-aos-delay={(index % 4) * 100}
                  data-aos-duration="600"
                >
                  <ProjectCard
                    project={{
                      ...project,
                      rank: index + 1,
                    }}
                    roundId={roundAddress ?? ""}
                  />
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const bars = [18, 28, 42, 58, 76, 92];

  return (
    <div data-aos="fade-left" data-aos-duration="800">
      <Frame className="overflow-hidden p-5 sm:p-6" interactive>
      <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <MonoLabel className="text-primary">{t.homeIntro.visualLabel}</MonoLabel>
          <p className="mt-2 max-w-xs text-sm text-muted">
            {t.homeIntro.visualDescription}
          </p>
        </div>
        <span className="terminal-caret mono-label text-money">{t.homeIntro.visualStatus}</span>
      </div>

      <div className="relative mt-6 h-56 overflow-hidden border border-line bg-bg/60 p-4">
        <div className="absolute inset-0 bg-[linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] bg-[length:28px_28px] opacity-50" />
        <svg
          viewBox="0 0 260 170"
          className="absolute inset-x-3 top-4 h-44 w-[calc(100%-1.5rem)]"
          aria-hidden="true"
        >
          <path
            d="M12 146 C64 140 82 86 118 72 C158 56 184 96 246 18"
            fill="none"
            stroke="var(--money)"
            strokeWidth="2"
            strokeLinecap="square"
            className="qf-curve"
          />
          <path
            d="M12 146 C64 140 82 86 118 72 C158 56 184 96 246 18"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="8"
            strokeLinecap="square"
            opacity="0.12"
          />
        </svg>
        <div className="relative z-10 flex h-full items-end justify-between gap-2">
          {bars.map((height, index) => (
            <div key={height} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="qf-bar w-full border border-money/40 bg-money/15"
                style={{
                  height: `${height}%`,
                  animationDelay: `${index * 90}ms`,
                }}
              />
              <span className="h-1.5 w-1.5 bg-primary" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[t.homeIntro.visualOne, t.homeIntro.visualRoot, t.homeIntro.visualMatch].map((label) => (
          <div key={label} className="border border-line bg-surface px-2 py-2">
            <span className="mono-label text-muted">{label}</span>
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
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const sectionIds = ["intro", "how-it-works", "projects-list"];
    let ticking = false;

    const updateActiveSection = () => {
      const marker = window.innerHeight * 0.35;
      let nextActive = sectionIds[0];

      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (!section) continue;

        const rect = section.getBoundingClientRect();
        if (rect.top <= marker) {
          nextActive = id;
        }
      }

      setActiveSection(nextActive);
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
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

  const activeRound: Round | null = useMemo(() => {
    if (!roundAddress) return null;
    return {
      id: roundAddress,
      title: t.homeIntro.roundTitle,
      description: t.homeIntro.roundDescription,
      matchingPool: poolUsdc,
      totalDonated: totalDirectDonated,
      totalSupporters,
      projectCount: approvedProjects.length,
      startTime: startTime
        ? new Date(Number(startTime) * 1000).toISOString()
        : new Date().toISOString(),
      endTime: endTime ? new Date(Number(endTime) * 1000).toISOString() : new Date().toISOString(),
      status,
      sponsorName: t.homeIntro.sponsorName,
    };
  }, [
    roundAddress,
    poolUsdc,
    totalDirectDonated,
    totalSupporters,
    approvedProjects.length,
    startTime,
    endTime,
    status,
    t.homeIntro.roundDescription,
    t.homeIntro.roundTitle,
    t.homeIntro.sponsorName,
  ]);

  const sideNav = [
    { id: "intro", label: t.homeIntro.sideIntro },
    { id: "how-it-works", label: t.homeIntro.sideFlow },
    { id: "projects-list", label: t.homeIntro.sideProjects },
  ];

  const howItWorks = [
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
    <div className="relative space-y-0 overflow-x-hidden">
      <nav
        aria-label={t.homeIntro.sectionNavLabel}
        className="fixed right-[max(1.5rem,calc((100vw-72rem)/2-4rem))] top-1/2 z-20 hidden -translate-y-1/2 lg:block"
      >
        <div className="flex flex-col items-center gap-3 border border-line bg-bg/80 px-2 py-3 backdrop-blur-md">
          {sideNav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setActiveSection(item.id)}
              className={`group relative h-2.5 w-2.5 border transition-colors ${
                activeSection === item.id
                  ? "border-primary bg-primary"
                  : "border-line-strong bg-surface hover:border-primary"
              }`}
              aria-current={activeSection === item.id ? "true" : undefined}
            >
              <span className="sr-only">{item.label}</span>
              <span className="mono-label pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 whitespace-nowrap border border-line bg-bg px-2 py-1 text-muted group-hover:block">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </nav>

      <section
        id="intro"
        className="grid scroll-mt-24 gap-8 border-b border-line pb-10 pt-2 lg:grid-cols-[1.04fr_0.96fr] lg:items-center"
      >
        <div className="space-y-6" data-aos="fade-right" data-aos-duration="800">
          <MonoLabel className="text-primary">{t.homeIntro.eyebrow}</MonoLabel>
          <h1 className="max-w-5xl text-[clamp(2.5rem,12vw,4.25rem)] font-bold leading-[0.94] text-foreground lg:text-[clamp(4rem,6vw,5.8rem)]">
            {t.homeIntro.headlineStart}{" "}
            <GradientBorder className="inline-block bg-surface px-3 py-1 align-baseline">
              {t.homeIntro.headlineAccent}
            </GradientBorder>
          </h1>

          <p className="max-w-2xl text-base leading-8 text-muted sm:text-lg">
            {t.homeIntro.subheadline}
          </p>

          <div className="grid gap-3 pt-2 sm:flex sm:flex-wrap sm:items-center">
            <a
              href="#round"
              className="gradient-border mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 py-2.5 text-foreground focus:outline-none sm:w-auto"
            >
              <span>{t.homeIntro.primaryCta}</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <Link
              href="/register"
              className="mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 border border-line-strong bg-surface px-5 py-2.5 text-muted focus:outline-none sm:w-auto"
            >
              <Rocket className="h-4 w-4" />
              <span>{t.homeIntro.secondaryCta}</span>
            </Link>
          </div>

          <div className="grid gap-3 pt-3 sm:grid-cols-3">
            {howItWorks.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  data-aos="fade-up"
                  data-aos-delay={idx * 120}
                  data-aos-duration="600"
                >
                  <Frame className="p-4 h-full" interactive>
                    <div className="flex items-start gap-3">
                      <div className={`border border-line-strong bg-bg p-2 ${step.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <MonoLabel className={step.tone}>
                          {t.homeIntro.stepLabel} {step.step}
                        </MonoLabel>
                        <h3 className="mt-2 text-sm font-bold text-foreground">{step.title}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-muted">{step.description}</p>
                      </div>
                    </div>
                  </Frame>
                </div>
              );
            })}
          </div>
        </div>

        <QuadraticVisual />
      </section>

      <section
        aria-label={t.homeIntro.statsAria}
        id="round"
        className="grid scroll-mt-24 grid-cols-1 border-b border-line py-6 sm:grid-cols-3"
      >
        {isLoading ? (
          <>
            <Skeleton className="h-32 border-r-0" />
            <Skeleton className="h-32 border-r-0" />
            <Skeleton className="h-32" />
          </>
        ) : !roundAddress ? (
          <div className="border border-line bg-surface p-5 sm:col-span-3">
            <MonoLabel className="text-primary">{t.homeIntro.noRoundTitle}</MonoLabel>
            <p className="mt-2 max-w-2xl text-sm text-muted">{t.homeIntro.noRoundDesc}</p>
            <button
              type="button"
              onClick={() => router.push(isAdmin ? "/admin" : "/register")}
              className="mono-label mt-4 inline-flex min-h-11 items-center border border-primary bg-primary/10 px-4 py-2 text-primary hover:bg-primary hover:text-foreground"
            >
              {isAdmin ? t.homeIntro.createRoundCta : t.homeIntro.registerFallbackCta}
            </button>
          </div>
        ) : (
          <>
            <Frame
              className="border-r-0 p-5"
              data-aos="fade-up"
              data-aos-delay="0"
              data-aos-duration="600"
            >
              <div className="mono-label flex items-center gap-2 text-money">
                <Coins className="h-4 w-4" />
                <span>{t.hero.statPool}</span>
              </div>
              <div className="tabular-mono mt-2 text-3xl font-black text-money">
                {formatUsdc(poolUsdc)}
              </div>
              <p className="mt-1 text-[11px] text-muted">{t.homeIntro.poolNote}</p>
            </Frame>

            <Frame
              className="border-r-0 p-5"
              data-aos="fade-up"
              data-aos-delay="100"
              data-aos-duration="600"
            >
              <div className="mono-label flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" />
                <span>{t.hero.statSupporters}</span>
              </div>
              <div className="tabular-mono mt-2 text-3xl font-black text-foreground">
                {formatNumber(totalSupporters)}
              </div>
              <p className="mt-1 text-[11px] text-muted">{t.homeIntro.supportersNote}</p>
            </Frame>

            <Frame
              className="p-5"
              data-aos="fade-up"
              data-aos-delay="200"
              data-aos-duration="600"
            >
              <div className="mono-label flex items-center gap-2 text-muted">
                <Rocket className="h-4 w-4" />
                <span>{t.hero.statProjects}</span>
              </div>
              <div className="tabular-mono mt-2 text-3xl font-black text-foreground">
                {formatNumber(approvedProjects.length)}
              </div>
              <p className="mt-1 text-[11px] text-muted">{t.homeIntro.projectsNote}</p>
            </Frame>
          </>
        )}
      </section>

      <section id="how-it-works" className="scroll-mt-24 space-y-6 border-b border-line py-10">
        <div data-aos="fade-up" data-aos-duration="600">
          <MonoLabel>{t.howItWorks.title}</MonoLabel>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {t.howItWorks.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t.howItWorks.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
          {howItWorks.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Frame
                key={step.step}
                className="p-4"
                interactive
                data-aos="fade-up"
                data-aos-delay={idx * 150}
                data-aos-duration="600"
              >
                <div className={`inline-flex border border-line-strong bg-bg p-2 ${step.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`mono-label mt-4 block ${step.tone}`}>
                  {t.homeIntro.stepLabel} {step.step}
                </span>
                <h3 className="mt-2 text-sm font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{step.description}</p>
              </Frame>
            );
          })}
        </div>
      </section>

      {hasError ? (
        <section className="py-10" data-aos="fade-up">
          <ErrorState
            title={t.homeIntro.errorTitle}
            reason={t.homeIntro.errorReason}
            solution={t.homeIntro.errorSolution}
            onRetry={() => {
              refetchRound();
              refetchProjects();
            }}
          />
        </section>
      ) : activeRound ? (
        <section className="space-y-4 border-b border-line py-10" data-aos="fade-up" data-aos-duration="700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t.roundCard.openTitle}
            </h2>
            <span className="mono-label text-muted">{t.homeIntro.activeRoundLabel}</span>
          </div>
          <RoundCard round={activeRound} />
        </section>
      ) : null}

      <section id="projects-list" className="scroll-mt-24 space-y-6 py-10">
        <div
          className="flex flex-col justify-between gap-2 border-b border-line pb-4 sm:flex-row sm:items-end"
          data-aos="fade-up"
          data-aos-duration="600"
        >
          <div>
            <MonoLabel>{t.homeIntro.projectsEyebrow}</MonoLabel>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
              {t.homeIntro.projectsTitle}
            </h2>
            <p className="text-xs text-muted sm:text-sm">{t.homeIntro.projectsSubtitle}</p>
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
      </section>
    </div>
  );
}

"use client";

import { AOSInit } from "@/components/common/AOSInit";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { Container } from "@/components/layout/Container";
import {
  ArrowRight,
  Rocket,
} from "lucide-react";
import { HowItWorksTimeline } from "@/components/home/HowItWorksTimeline";
import { FeaturedRoundsSection, FeaturedProjectsSection } from "@/components/home/FeaturedRounds";
import { NetworkStats } from "@/components/home/NetworkStats";
import AeroShards from "@/components/home/DeferredAeroShards";
import { ChainLatticeBackground } from "@/components/background/DeferredLattice";
import { TypewriterText } from "@/components/home/TypewriterText";


export function HomeView() {
  const { t } = useLocale();
  const { isPlatformOwner } = useRole();
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("intro");
  const [headerHeight, setHeaderHeight] = useState(102);

  useEffect(() => {
    const sectionIds = ["intro", "stats", "how-it-works", "current-round", "projects-list"];
    let frame: number | null = null;

    const updateHeaderHeight = () => {
      const header = document.querySelector("header");
      if (header) {
        const nextH = header.offsetHeight;
        setHeaderHeight(prev => (prev === nextH ? prev : nextH));
      }
    };

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

    const header = document.querySelector("header");
    let headerObserver: ResizeObserver | null = null;
    if (header) {
      headerObserver = new ResizeObserver(updateHeaderHeight);
      headerObserver.observe(header);
    }
    updateHeaderHeight();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("splash-intro-finished", scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      headerObserver?.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("splash-intro-finished", scheduleUpdate);
    };
  }, []);

  const sideNav = [
    { id: "intro", label: t.homeIntro.sideIntro },
    { id: "stats", label: t.homeIntro.sideStats },
    { id: "how-it-works", label: t.homeIntro.sideFlow },
    { id: "current-round", label: t.roundCard.openTitle },
    { id: "projects-list", label: t.homeIntro.sideProjects },
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
              className={`group relative h-2.5 w-2.5 border transition-all cursor-pointer ${activeSection === item.id
                ? "border-primary bg-primary scale-125"
                : "border-line-strong bg-surface hover:border-primary hover:scale-110"
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

      {/* 1. Hero Section: Takes 100% of the viewport height below header */}
      <section
        id="intro"
        className="relative flex flex-col justify-center scroll-mt-20 overflow-hidden bg-bg"
        style={{ minHeight: `calc(100dvh - ${headerHeight}px)` }}
      >
        {/* AeroShards 3D Cyber Shards Background - ONLY in Hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-60"
        >
          <AeroShards
            shardColor="#f43f5e"
            accentColor="#ff2a6d"
            backgroundColor="#07070c"
            material="glass"
            count={750}
            speed={0.5}
            glow={0.45}
            grain={0.04}
            placement="full"
          />
        </div>

        {/* Layer 2: Aurora glows (Top-left red/orange ~12%, Bottom-right green ~10%) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -left-20 z-0 h-[480px] w-[540px] rounded-full bg-primary opacity-[0.12] blur-[140px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -right-16 z-0 h-[520px] w-[560px] rounded-full bg-money opacity-[0.10] blur-[150px]"
        />

        {/* Layer 3: Noise / grain texture (opacity ~3.5%) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Layer 4: Subtle twinkling stars scattered across hero */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {[
            { top: "18%", left: "12%", delay: "0s", size: "w-1 h-1" },
            { top: "28%", left: "44%", delay: "1.8s", size: "w-1 h-1" },
            { top: "14%", left: "82%", delay: "3.2s", size: "w-1.5 h-1.5" },
            { top: "68%", left: "20%", delay: "2.4s", size: "w-1 h-1" },
            { top: "78%", left: "74%", delay: "0.9s", size: "w-1 h-1" },
            { top: "42%", left: "92%", delay: "4.1s", size: "w-1 h-1" },
            { top: "84%", left: "38%", delay: "2.7s", size: "w-1 h-1" },
          ].map((star, i) => (
            <span
              key={i}
              style={{ top: star.top, left: star.left, animationDelay: star.delay }}
              className={`absolute rounded-full bg-white opacity-25 animate-pulse ${star.size}`}
            />
          ))}
        </div>

        {/* Bottom fade to transition smoothly into the next section */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 inset-x-0 z-0 h-28 bg-gradient-to-t from-black to-transparent"
        />
        <div aria-hidden="true" className="chain-lattice-hero-bridge" />

        <Container className="relative z-10 flex flex-1 w-full flex-col justify-center py-6 sm:py-8 lg:py-10">
          <div className="max-w-4xl lg:max-w-5xl space-y-6" data-aos="fade-right" data-aos-duration="800">
            <h1 className="hero-headline font-bold text-foreground max-w-4xl lg:max-w-5xl">
              <span>{t.homeIntro.headlineStart} </span>
              <span className="text-primary inline-block min-h-[1.12em]">
                <TypewriterText
                  phrases={t.homeIntro.headlinePhrases || [t.homeIntro.headlineAccent]}
                  initialText={t.homeIntro.headlineAccent}
                />
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {t.homeIntro.subheadline}
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                href="/round"
                className="gradient-border mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 px-6 py-2.5 text-foreground focus:outline-none sm:w-auto cursor-pointer transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <span>{t.homeIntro.primaryCta}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {!isPlatformOwner && (
                <Link
                  href="/register"
                  className="mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 border border-line-strong bg-surface px-6 py-2.5 text-muted transition-all hover:bg-surface-2 hover:border-line hover:text-foreground focus:outline-none sm:w-auto cursor-pointer active:scale-[0.98]"
                >
                  <Rocket className="h-4 w-4" />
                  <span>{t.homeIntro.secondaryCta}</span>
                </Link>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* 2. Stats strip: Unified Network Metrics Bar (Team1 / Avalanche style) */}
      <section
        id="stats"
        aria-label={t.homeIntro.statsAria}
        className="chain-lattice-host chain-lattice-host--stats scroll-mt-20"
      >
        <ChainLatticeBackground variant="dense" />
        <Container className="py-[clamp(2.5rem,5vw,4.5rem)]" data-aos="fade-up" data-aos-duration="600">
          <NetworkStats />
        </Container>
      </section>

      {/* 3. How it works: Scroll-driven Blockchain Timeline */}
      <HowItWorksTimeline />

      {/* 4. Featured rounds (by open status, then matching pool) */}
      <FeaturedRoundsSection />

      {/* 5. Featured projects of each featured round (by supporters, then amount) */}
      <FeaturedProjectsSection />
    </div>
  );
}

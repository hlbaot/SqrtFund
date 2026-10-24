"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { PenLine, HandCoins, Calculator } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { Container } from "@/components/layout/Container";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { ChainLatticeBackground } from "@/components/background/DeferredLattice";

interface StepData {
  step: string;
  blockNum: string;
  hash: string;
  titleEn: string;
  titleVi: string;
  descEn: string;
  descVi: string;
  icon: typeof PenLine;
}

const STEPS: StepData[] = [
  {
    step: "01",
    blockNum: "#4892101",
    hash: "0x7a3f…c91e",
    titleEn: "Register",
    titleVi: "Đăng ký",
    descEn: "Clubs submit a project.",
    descVi: "CLB gửi dự án.",
    icon: PenLine,
  },
  {
    step: "02",
    blockNum: "#4892102",
    hash: "0x8b14…3d52",
    titleEn: "Donate",
    titleVi: "Quyên góp",
    descEn: "Students choose how much to contribute.",
    descVi: "Sinh viên tự chọn số tiền đóng góp.",
    icon: HandCoins,
  },
  {
    step: "03",
    blockNum: "#4892103",
    hash: "0x2e99…a70f",
    titleEn: "Match",
    titleVi: "Chia quỹ",
    descEn: "Pool splits by supporters.",
    descVi: "Quỹ chia theo số người ủng hộ.",
    icon: Calculator,
  },
];

export function HowItWorksTimeline() {
  const { locale } = useLocale();
  const isVi = locale === "vi";

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(64);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Active step thresholds
  const activeStep1 = scrollProgress >= 0.05;
  const activeStep2 = scrollProgress >= 0.40;
  const activeStep3 = scrollProgress >= 0.78;

  // Track fill percentage across timeline (0 to 100%)
  const trackFill = useMemo(() => {
    if (scrollProgress < 0.05) return 0;
    if (scrollProgress < 0.42) {
      return ((scrollProgress - 0.05) / 0.37) * 50;
    }
    if (scrollProgress < 0.82) {
      return 50 + ((scrollProgress - 0.42) / 0.40) * 50;
    }
    return 100;
  }, [scrollProgress]);

  // Terminal typing animation for Step 1
  const [typedCommand, setTypedCommand] = useState("");
  useEffect(() => {
    if (!activeStep1) {
      const frame = requestAnimationFrame(() => setTypedCommand(""));
      return () => cancelAnimationFrame(frame);
    }
    const fullText = "submit_project(\"UniDAO\")";
    let curr = 0;
    const interval = setInterval(() => {
      curr++;
      setTypedCommand(fullText.slice(0, curr));
      if (curr >= fullText.length) clearInterval(interval);
    }, 45);
    return () => clearInterval(interval);
  }, [activeStep1]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    const updateHeaderAndScroll = () => {
      const header = document.querySelector("header");
      const currentH = header ? header.offsetHeight : 64;
      setHeaderHeight(currentH);

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScroll = containerRef.current.offsetHeight - (window.innerHeight - currentH);
      if (totalScroll <= 0) return;
      const currentScroll = currentH - rect.top;
      const rawProgress = Math.min(Math.max(currentScroll / totalScroll, 0), 1);
      setScrollProgress(rawProgress);
    };

    window.addEventListener("scroll", updateHeaderAndScroll, { passive: true });
    window.addEventListener("resize", updateHeaderAndScroll);
    const initialFrame = requestAnimationFrame(() => {
      setPrefersReducedMotion(mediaQuery.matches);
      updateHeaderAndScroll();
    });

    return () => {
      cancelAnimationFrame(initialFrame);
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("scroll", updateHeaderAndScroll);
      window.removeEventListener("resize", updateHeaderAndScroll);
    };
  }, []);

  // If user prefers reduced motion, render clean static 3-column layout
  if (prefersReducedMotion) {
    return (
      <section id="how-it-works" className="chain-lattice-host relative scroll-mt-20 py-20 text-white">
        <ChainLatticeBackground variant="dense" />
        <Container className="space-y-12">
          <div>
            <MonoLabel className="text-primary">
              {isVi ? "CÁCH HOẠT ĐỘNG" : "HOW IT WORKS"}
            </MonoLabel>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isVi ? "Cách thức hoạt động" : "How it works"}
            </h2>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {isVi
                ? "Từ đăng ký đến đối ứng quỹ, chỉ trong ba bước."
                : "From registration to matched funding, in three steps."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="relative border border-line bg-surface/80 backdrop-blur-sm p-6 rounded-[4px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[4px] border border-[#E84142] bg-surface text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-[#71717A]">
                      STEP {s.step}
                    </span>
                  </div>
                  <h3 className="mt-6 text-[20px] font-semibold text-white">
                    {isVi ? s.titleVi : s.titleEn}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#A1A1AA]">
                    {isVi ? s.descVi : s.descEn}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section id="how-it-works" className="relative scroll-mt-20 text-white">
      {/* DESKTOP VIEW: 300vh Scroll-driven timeline pinned under navbar */}
      <div ref={containerRef} className="relative hidden h-[300vh] w-full md:block">
        <div
          className="chain-lattice-host sticky flex w-full flex-col justify-center overflow-hidden px-4 py-4 lg:px-8"
          style={{
            top: `${headerHeight}px`,
            height: `calc(100vh - ${headerHeight}px)`,
          }}
        >
          <ChainLatticeBackground variant="dense" />
          {/* UNIFIED FRAME: Header + Timeline + Status */}
          <Container className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center gap-6 lg:gap-8">
            {/* 1. Header (Synchronized with site section headers) */}
            <div className="flex flex-col items-start justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-end">
              <div>
                <MonoLabel className="text-primary">
                  {isVi ? "CÁCH HOẠT ĐỘNG" : "HOW IT WORKS"}
                </MonoLabel>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {isVi ? "Cách thức hoạt động" : "How it works"}
                </h2>
                <p className="mt-1 text-xs text-muted sm:text-sm">
                  {isVi
                    ? "Từ đăng ký đến đối ứng quỹ, chỉ trong ba bước."
                    : "From registration to matched funding, in three steps."}
                </p>
              </div>

              {/* Progress counter right-aligned */}
              <div className="mono-label hidden items-center gap-2 text-muted sm:flex">
                <span>CHAIN PROGRESS</span>
                <span className="font-bold text-foreground">{Math.round(scrollProgress * 100)}%</span>
              </div>
            </div>

            {/* 2. Central Timeline & 3 Journey Nodes */}
            <div className="relative mx-auto w-full pt-2 pb-2">
              {/* Timeline Track: 1px rgba(255,255,255,0.12) */}
              <div className="absolute left-[8%] right-[8%] top-[86px] h-[1px] -translate-y-1/2 bg-white/12" />

              {/* Active Progress Fill Line: 1px Solid Red #E84142 */}
              <div
                className="absolute left-[8%] top-[86px] h-[1px] -translate-y-1/2 bg-[#E84142] transition-all duration-150 ease-out"
                style={{
                  width: `calc((100% - 16%) * ${trackFill / 100})`,
                }}
              >
                {/* Solid 6px Red Dot at Leading Edge (NO GLOW) */}
                {trackFill > 0 && trackFill < 100 && (
                  <span
                    className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#E84142]"
                  />
                )}
              </div>

              {/* 3 Nodes Grid */}
              <div className="grid grid-cols-3 gap-4 lg:gap-8">
                {STEPS.map((s, idx) => {
                  const Icon = s.icon;
                  const isConfirmed = idx === 0 ? activeStep1 : idx === 1 ? activeStep2 : activeStep3;
                  const isCurrentActive =
                    (idx === 0 && activeStep1 && !activeStep2) ||
                    (idx === 1 && activeStep2 && !activeStep3) ||
                    (idx === 2 && activeStep3);

                  return (
                    <div
                      key={s.step}
                      className={`relative flex flex-col items-center text-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isConfirmed ? "opacity-100" : "opacity-35"
                      } ${!isCurrentActive && isConfirmed ? "opacity-60" : ""}`}
                    >
                      {/* Big Journey Number Watermark behind Node: "01", "02", "03" (64-88px) */}
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute top-[34px] left-1/2 -translate-x-1/2 font-sans font-black text-7xl lg:text-8xl select-none transition-all duration-500 ${
                          isConfirmed ? "text-white/[0.16]" : "text-white/[0.08]"
                        }`}
                      >
                        {s.step}
                      </span>

                      {/* Top: Block info & hash */}
                      <div className="mb-3 flex flex-col items-center h-10 justify-end z-10">
                        {isConfirmed ? (
                          <div className="flex flex-col items-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                            <div className="font-mono flex items-center gap-1.5 text-[11px] font-medium tracking-[0.1em] text-white">
                              <span>BLOCK {s.step}</span>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] inline-block" />
                              <span>CONFIRMED</span>
                            </div>
                            <span className="font-mono text-[10px] text-[#71717A] tracking-[0.05em] mt-0.5">
                              {s.blockNum} ({s.hash})
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-[10px] tracking-[0.1em] text-[#71717A]">
                              BLOCK {s.step} · PENDING
                            </span>
                            <span className="font-mono text-[10px] text-transparent select-none mt-0.5">
                              placeholder
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Node: 56px Square, rounded-[4px], bg-black, 1px border */}
                      <div className="relative flex items-center justify-center z-10">
                        {/* 1 single 1px ripple wave when active (600ms) */}
                        {isCurrentActive && (
                          <span
                            className="absolute -inset-2 rounded-[4px] border border-[#E84142]/40 animate-ping pointer-events-none"
                            style={{ animationDuration: "1.2s" }}
                          />
                        )}

                        <div
                          className={`relative flex h-14 w-14 items-center justify-center rounded-[4px] border bg-surface/90 backdrop-blur-sm transition-all duration-400 ${
                            isConfirmed
                              ? "border-[#E84142] text-white shadow-[0_0_15px_rgba(232,65,66,0.15)]"
                              : "border-line text-[#71717A]"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Bottom Step Content (Slide up 12px + fade) */}
                      <div
                        className={`mt-4 flex flex-col items-center max-w-[240px] z-10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isConfirmed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-40"
                        }`}
                      >
                        <span className="font-mono text-[11px] tracking-[0.1em] text-[#71717A] uppercase">
                          STEP {s.step}
                        </span>

                        <h3 className="mt-1 text-[20px] font-semibold text-white">
                          {isVi ? s.titleVi : s.titleEn}
                        </h3>

                        <p className="mt-1 text-[14px] leading-relaxed text-[#A1A1AA]">
                          {isVi ? s.descVi : s.descEn}
                        </p>

                        {/* Minimalist Engineering Mini-Visuals */}
                        <div className="mt-4 w-full min-h-[48px] flex items-center justify-center">
                          {/* Step 01: Clean Terminal Command */}
                          {idx === 0 && (
                            <div
                              className={`w-full max-w-[220px] rounded-[4px] border border-line bg-surface/90 backdrop-blur-sm px-3 py-1.5 text-left font-mono text-xs text-white transition-all duration-400 ${
                                isConfirmed ? "opacity-100" : "opacity-0 pointer-events-none"
                              }`}
                            >
                              <div className="truncate">
                                <span className="text-[#E84142]">&gt; </span>
                                <span>{typedCommand}</span>
                                <span className="inline-block w-1.5 h-3 ml-0.5 bg-[#E84142] animate-pulse align-middle" />
                              </div>
                            </div>
                          )}

                          {/* Step 02: Clean Minimal Chips */}
                          {idx === 1 && (
                            <div
                              className={`flex items-center justify-center gap-2 transition-all duration-400 ${
                                isConfirmed ? "opacity-100" : "opacity-0 pointer-events-none"
                              }`}
                            >
                              <span className="font-mono text-xs text-white rounded-[4px] border border-white/12 bg-transparent px-2.5 py-1">
                                +1 USDC
                              </span>
                              <span className="font-mono text-xs text-white rounded-[4px] border border-white/12 bg-transparent px-2.5 py-1">
                                +5 USDC
                              </span>
                            </div>
                          )}

                          {/* Step 03: (√N)² amplification */}
                          {idx === 2 && (
                            <div
                              className={`flex items-center justify-center transition-all duration-400 ${
                                isConfirmed ? "opacity-100" : "opacity-0 pointer-events-none"
                              }`}
                            >
                              <div className="flex items-center gap-2 font-mono text-xs text-white">
                                <span>(√N)² amplification</span>
                                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                                <span className="text-[11px] text-[#A1A1AA]">distributed</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </Container>
        </div>
      </div>

      {/* MOBILE VIEW: Vertical Timeline (Clean Engineering Style) */}
      <div className="chain-lattice-host block md:hidden py-14 px-4 sm:px-6">
        <ChainLatticeBackground variant="dense" />
        <Container className="space-y-10">
          <div>
            <MonoLabel className="text-primary">
              {isVi ? "CÁCH HOẠT ĐỘNG" : "HOW IT WORKS"}
            </MonoLabel>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isVi ? "Cách thức hoạt động" : "How it works"}
            </h2>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {isVi
                ? "Từ đăng ký đến đối ứng quỹ, chỉ trong ba bước."
                : "From registration to matched funding, in three steps."}
            </p>
          </div>

          <div className="relative pl-6 space-y-10">
            {/* 1px Vertical Track Line */}
            <div className="absolute left-[18px] top-4 bottom-4 w-[1px] bg-white/12" />

            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="relative flex items-start gap-4">
                  {/* Vertical Node: 38px Square, rounded-[4px], border #E84142 */}
                  <div className="relative -left-[14px] flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-[#E84142] bg-surface text-white">
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1 pt-0.5">
                    <div className="font-mono flex flex-wrap items-center gap-2 text-[11px] text-white">
                      <span>STEP {s.step}</span>
                      <span className="text-[#71717A]">·</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                      <span>CONFIRMED</span>
                    </div>

                    <h3 className="text-[18px] font-semibold text-white">
                      {isVi ? s.titleVi : s.titleEn}
                    </h3>

                    <p className="text-[13px] text-[#A1A1AA] leading-relaxed">
                      {isVi ? s.descVi : s.descEn}
                    </p>

                    <div className="pt-1 font-mono text-[10px] text-[#71717A]">
                      hash: {s.hash}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </Container>
      </div>
    </section>
  );
}

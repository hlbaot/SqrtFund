"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Coins, Rocket } from "lucide-react";
import { useBlockNumber } from "wagmi";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useLocale } from "@/lib/context/locale";
import { formatNumber } from "@/lib/format";

/**
 * Custom hook for smooth count-up animation over a specified duration
 */
function useCountUp(target: number, duration: number = 800, active: boolean = true): number {
  const [value, setValue] = useState(0);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    let start: number | null = null;
    const startVal = prevTargetRef.current;
    prevTargetRef.current = target;
    const diff = target - startVal;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || reducedMotion || diff === 0) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    let rafId: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // Easing cubic-bezier(0.22, 1, 0.36, 1) approximation
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startVal + diff * ease));

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, active]);

  return value;
}

export function NetworkStats() {
  const router = useRouter();
  const { locale } = useLocale();
  const isVi = locale === "vi";

  const {
    pool,
    isLoading: isRoundLoading,
    isError: isRoundError,
  } = useRound();

  const {
    projects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
  } = useProjects();

  const { data: blockNumber } = useBlockNumber({ watch: true });
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to trigger count-up when section enters viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track seconds elapsed since last on-chain block update
  useEffect(() => {
    const resetFrame = requestAnimationFrame(() => setSecondsAgo(0));
    const interval = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => { cancelAnimationFrame(resetFrame); clearInterval(interval); };
  }, [blockNumber]);

  // Derived metrics
  const approvedProjects = useMemo(() => projects.filter((p) => p.approved), [projects]);
  const pendingProjectsCount = useMemo(() => projects.filter((p) => !p.approved).length, [projects]);

  const totalSupporters = useMemo(() => {
    return approvedProjects.reduce((acc, p) => acc + p.supporterCount, 0);
  }, [approvedProjects]);

  const poolUsdc = useMemo(() => {
    return pool ? Math.round(Number(pool) / 1_000_000) : 0;
  }, [pool]);

  const isLoading = isRoundLoading || isProjectsLoading;
  const isOffline = isRoundError || isProjectsError;

  // Count-up animated values
  const animatedSupporters = useCountUp(totalSupporters, 800, inView);
  const animatedPool = useCountUp(poolUsdc, 800, inView);
  const animatedProjects = useCountUp(approvedProjects.length, 800, inView);

  // On-chain data tick indicator
  const [tick, setTick] = useState(false);
  useEffect(() => {
    if (inView) {
      const frame = requestAnimationFrame(() => setTick(true));
      const timer = setTimeout(() => setTick(false), 250);
      return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
    }
  }, [totalSupporters, poolUsdc, approvedProjects.length, inView]);

  // Smooth scroll handler for internal page sections
  const handleScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Unified "Metrics Bar" container */}
      <div className="relative rounded-[4px] border border-white/12 bg-[#000000] overflow-hidden text-white shadow-2xl transition-all duration-300">
        {/* 4 Corner Brackets (8px x 8px Red #E84142) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[1px] -left-[1px] z-30 h-2 w-2 border-t-2 border-l-2 border-[#E84142]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[1px] -right-[1px] z-30 h-2 w-2 border-t-2 border-r-2 border-[#E84142]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[1px] -left-[1px] z-30 h-2 w-2 border-b-2 border-l-2 border-[#E84142]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[1px] -right-[1px] z-30 h-2 w-2 border-b-2 border-r-2 border-[#E84142]"
        />

        {/* 1. TOP BAR (32px high, bg-white/[0.02], border-b border-white/12) */}
        <div className="relative z-10 flex h-8 items-center justify-between border-b border-white/12 bg-white/[0.02] px-4 font-mono text-[11px]">
          {/* Left: ● LIVE or ● OFFLINE */}
          <div className="flex items-center gap-2">
            {isOffline ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#E84142] animate-pulse" />
                <span className="font-semibold tracking-[0.08em] text-[#E84142]">
                  {isVi ? "OFFLINE · ĐANG THỬ LẠI" : "OFFLINE · RETRYING"}
                </span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="font-semibold tracking-[0.08em] text-[#A1A1AA]">
                  LIVE
                </span>
              </>
            )}
          </div>

          {/* Right: Real update time */}
          <div className="text-[#71717A] tracking-[0.05em]">
            <span>
              {isVi ? `CẬP NHẬT ${secondsAgo}S TRƯỚC` : `UPDATED ${secondsAgo}S AGO`}
            </span>
          </div>
        </div>

        {/* 2. THREE UNIFIED METRIC COLUMNS (Divided by 1px borders, no gaps) */}
        <div className="relative z-10 grid grid-cols-1 divide-y divide-white/12 md:grid-cols-3 md:divide-y-0 md:divide-x">
          {/* COLUMN 1: SUPPORTERS */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => router.push("/my/activity")}
            onKeyDown={(e) => e.key === "Enter" && router.push("/my/activity")}
            className="group relative flex flex-col justify-between overflow-hidden p-6 lg:p-8 cursor-pointer transition-all duration-300 hover:bg-white/[0.015]"
          >
            {/* Column hover outline highlight */}
            <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-300 group-hover:border-[#E84142]/60 z-20" />

            {/* Giant watermark number behind column */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-4 font-mono font-black text-[140px] lg:text-[180px] xl:text-[200px] leading-none text-white/[0.03] select-none z-0 hidden lg:block"
            >
              {totalSupporters}
            </span>

            {/* Row 1: Icon + Mono Label + Trend Chip */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[#A1A1AA]">
                <Users className="h-4 w-4 text-[#A1A1AA]" />
                <span>{isVi ? "NGƯỜI ỦNG HỘ" : "SUPPORTERS"}</span>
              </div>

              {/* Trend chip: +1 TODAY or ACTIVE */}
              {totalSupporters > 0 && (
                <span className="font-mono text-[10px] text-[#22c55e] border border-[#22c55e]/40 bg-[#22c55e]/10 px-1.5 py-0.5 rounded-[2px] tracking-wider">
                  +1 TODAY
                </span>
              )}
            </div>

            {/* Row 2: Main Number (Always White) */}
            <div className="relative z-10 my-4 sm:my-6">
              <div
                className={`font-mono font-bold text-white tracking-[-0.03em] tabular-nums text-4xl sm:text-5xl md:text-5xl lg:text-7xl xl:text-8xl leading-none transition-transform duration-250 ${tick ? "translate-y-2 opacity-80" : "translate-y-0 opacity-100"
                  }`}
              >
                {isLoading ? "—" : formatNumber(animatedSupporters)}
              </div>
              <p className="mt-2 text-sm text-[#A1A1AA]">
                {isVi ? "Sinh viên ủng hộ" : "Student supporters"}
              </p>
            </div>

            {/* Row 3: Mini-visual Slots (12 dots 8px) */}
            <div className="relative z-10 mt-auto pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5 h-6">
                {Array.from({ length: 12 }).map((_, i) => {
                  const isFilled = i < Math.min(12, totalSupporters);
                  return (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full transition-all duration-300 ${isFilled
                          ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] group-hover:scale-110"
                          : "border border-white/20 bg-transparent group-hover:border-white/40"
                        }`}
                      style={{ transitionDelay: `${i * 30}ms` }}
                    />
                  );
                })}
              </div>

              <div className="mt-2 font-mono text-[11px] text-[#71717A] flex items-center justify-between">
                <span>
                  {totalSupporters === 0
                    ? isVi
                      ? "Hãy là người đầu tiên ủng hộ →"
                      : "Be the first to donate →"
                    : isVi
                      ? `${totalSupporters} / 12 để mở khóa thưởng`
                      : `${totalSupporters} / 12 to unlock bonus`}
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: MATCHING POOL */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleScrollTo("current-round")}
            onKeyDown={(e) => e.key === "Enter" && handleScrollTo("current-round")}
            className="group relative flex flex-col justify-between overflow-hidden p-6 lg:p-8 cursor-pointer transition-all duration-300 hover:bg-white/[0.015]"
          >
            {/* Column hover outline highlight */}
            <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-300 group-hover:border-[#E84142]/60 z-20" />

            {/* Giant watermark number behind column */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-4 font-mono font-black text-[140px] lg:text-[180px] xl:text-[200px] leading-none text-white/[0.03] select-none z-0 hidden lg:block"
            >
              {poolUsdc}
            </span>

            {/* Row 1: Icon + Mono Label */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[#A1A1AA]">
                <Coins className="h-4 w-4 text-[#A1A1AA]" />
                <span>{isVi ? "QUỸ ĐỐI ỨNG" : "MATCHING POOL"}</span>
              </div>

              {poolUsdc > 0 && (
                <span className="font-mono text-[10px] text-[#22c55e] border border-[#22c55e]/40 bg-[#22c55e]/10 px-1.5 py-0.5 rounded-[2px] tracking-wider">
                  ACTIVE
                </span>
              )}
            </div>

            {/* Row 2: Main Number (Always White, Unit 20px Gray) */}
            <div className="relative z-10 my-4 sm:my-6">
              <div
                className={`flex items-baseline font-mono font-bold text-white tracking-[-0.03em] tabular-nums text-4xl sm:text-5xl md:text-5xl lg:text-7xl xl:text-8xl leading-none transition-transform duration-250 ${tick ? "translate-y-2 opacity-80" : "translate-y-0 opacity-100"
                  }`}
              >
                <span>{isLoading ? "—" : formatNumber(animatedPool)}</span>
                <span className="ml-2 font-mono text-lg lg:text-xl font-normal text-[#71717A] tracking-normal">
                  USDC
                </span>
              </div>
              <p className="mt-2 text-sm text-[#A1A1AA]">
                {isVi ? "Quỹ đối ứng USDC" : "USDC matching pool"}
              </p>
            </div>

            {/* Row 3: Mini-visual Slots (4px horizontal bar divided into 20 segments) */}
            <div className="relative z-10 mt-auto pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-[3px] h-6 w-full">
                {Array.from({ length: 20 }).map((_, i) => {
                  const targetPool = 1000;
                  const filledCount = Math.min(20, Math.round((poolUsdc / targetPool) * 20));
                  const isFilled = i < filledCount;
                  return (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-[1px] transition-all duration-300 ${isFilled
                          ? "bg-[#E84142] shadow-[0_0_4px_rgba(232,65,66,0.6)]"
                          : "bg-white/12 group-hover:bg-white/20"
                        }`}
                      style={{ transitionDelay: `${i * 20}ms` }}
                    />
                  );
                })}
              </div>

              <div className="mt-2 font-mono text-[11px]">
                {poolUsdc === 0 ? (
                  <span className="text-[#E84142]/90 tracking-wide font-medium">
                    {isVi ? "CHỜ NẠP TIỀN ĐẦU TIÊN" : "AWAITING FIRST DEPOSIT"}
                  </span>
                ) : (
                  <span className="text-[#71717A]">
                    {formatNumber(poolUsdc)} / 1,000 USDC {isVi ? "mục tiêu" : "target"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* COLUMN 3: PROJECTS */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleScrollTo("projects-list")}
            onKeyDown={(e) => e.key === "Enter" && handleScrollTo("projects-list")}
            className="group relative flex flex-col justify-between overflow-hidden p-6 lg:p-8 cursor-pointer transition-all duration-300 hover:bg-white/[0.015]"
          >
            {/* Column hover outline highlight */}
            <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-300 group-hover:border-[#E84142]/60 z-20" />

            {/* Giant watermark number behind column */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-4 font-mono font-black text-[140px] lg:text-[180px] xl:text-[200px] leading-none text-white/[0.03] select-none z-0 hidden lg:block"
            >
              {approvedProjects.length}
            </span>

            {/* Row 1: Icon + Mono Label */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[#A1A1AA]">
                <Rocket className="h-4 w-4 text-[#A1A1AA]" />
                <span>{isVi ? "DỰ ÁN" : "PROJECTS"}</span>
              </div>

              {approvedProjects.length > 0 && (
                <span className="font-mono text-[10px] text-[#22c55e] border border-[#22c55e]/40 bg-[#22c55e]/10 px-1.5 py-0.5 rounded-[2px] tracking-wider">
                  {approvedProjects.length} ACTIVE
                </span>
              )}
            </div>

            {/* Row 2: Main Number (Always White) */}
            <div className="relative z-10 my-4 sm:my-6">
              <div
                className={`font-mono font-bold text-white tracking-[-0.03em] tabular-nums text-4xl sm:text-5xl md:text-5xl lg:text-7xl xl:text-8xl leading-none transition-transform duration-250 ${tick ? "translate-y-2 opacity-80" : "translate-y-0 opacity-100"
                  }`}
              >
                {isLoading ? "—" : formatNumber(animatedProjects)}
              </div>
              <p className="mt-2 text-sm text-[#A1A1AA]">
                {isVi ? "Dự án đã duyệt" : "Approved projects"}
              </p>
            </div>

            {/* Row 3: Mini-visual Slots (Row of 6 square boxes 10px) */}
            <div className="relative z-10 mt-auto pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 h-6">
                {Array.from({ length: 6 }).map((_, i) => {
                  const isApproved = i < approvedProjects.length;
                  return (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-[2px] transition-all duration-300 ${isApproved
                          ? "border border-[#E84142] bg-[#E84142]/20 shadow-[0_0_6px_rgba(232,65,66,0.3)] group-hover:scale-110"
                          : "border border-dashed border-white/20 bg-transparent group-hover:border-white/40"
                        }`}
                      style={{ transitionDelay: `${i * 40}ms` }}
                    />
                  );
                })}
              </div>

              <div className="mt-2 font-mono text-[11px] text-[#71717A]">
                {approvedProjects.length} {isVi ? "đã duyệt" : "approved"}
                <span className="mx-1.5">·</span>
                {pendingProjectsCount} {isVi ? "đang chờ" : "pending"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

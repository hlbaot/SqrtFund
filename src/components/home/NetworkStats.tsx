"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Coins, Rocket } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { useFactoryRounds } from "@/hooks/useRound";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { readMirrorRound } from "@/lib/store/chainSync";
import { roundsStore } from "@/lib/store/roundsStore";
import { roundReadRetry } from "@/lib/contracts/roundReads";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { isPublicRound } from "@/lib/roundVisibility";
import { QUERY_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";
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

type Column = {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  unit?: string;
  caption: string;
  onClick: () => void;
  visual: React.ReactNode;
  footer: React.ReactNode;
  badge?: string;
};

/**
 * Platform-wide stats aggregated over every public round (not only the latest one).
 */
export function NetworkStats() {
  const router = useRouter();
  const { locale } = useLocale();
  const isVi = locale === "vi";
  const nowSec = useCurrentTimestamp();
  const polling = useVisiblePolling();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { factoryData, isFactoryLoading, isFactoryError } = useFactoryRounds();

  const addresses = useMemo(
    () => ((factoryData?.[0]?.result as Address[] | undefined) ?? []).filter((a) => isPublicRound(a, TARGET_CHAIN_ID)),
    [factoryData],
  );

  const queries = useQueries({
    queries: addresses.map((address) => ({
      // Same key as useRound/useRegistrationRounds so the cache is shared.
      queryKey: ["round-fields", TARGET_CHAIN_ID, address.toLowerCase()],
      queryFn: async () => {
        const head = await client!.getBlockNumber({ cacheTime: 0 });
        const floor = roundsStore.getState().entities[address.toLowerCase()]?.confirmedBlock ?? 0n;
        const confirmedBlock = head < floor ? floor : head;
        return { ...(await readMirrorRound(client!, address, confirmedBlock)), confirmedBlock };
      },
      enabled: Boolean(client),
      staleTime: QUERY_STALE_MS,
      gcTime: QUERY_GC_MS,
      refetchInterval: polling,
      refetchIntervalInBackground: false,
      ...roundReadRetry,
    })),
  });

  const rounds = queries.map((q) => {
    const r = q.data?.results;
    const cancelled = r?.[15]?.result === true;
    const finalized = r?.[8]?.result === true;
    const endTime = r?.[3]?.result as bigint | undefined;
    const ended = endTime !== undefined && nowSec > 0 && BigInt(nowSec) >= endTime;
    return {
      pool: cancelled ? 0 : Number((r?.[7]?.result as bigint | undefined) ?? 0n) / 1_000_000,
      projects: Number((r?.[11]?.result as bigint | undefined) ?? 0n),
      active: !cancelled && !finalized && !ended,
      loaded: Boolean(r),
    };
  });

  const totalRounds = addresses.length;
  const activeRounds = rounds.filter((r) => r.active).length;
  const totalPool = Math.round(rounds.reduce((a, r) => a + r.pool, 0));
  const totalProjects = rounds.reduce((a, r) => a + r.projects, 0);
  const maxPool = Math.max(1, ...rounds.map((r) => r.pool));

  const isOffline = isFactoryError || queries.some((q) => q.isError);
  const isLoading = isFactoryLoading || (totalRounds > 0 && rounds.some((r) => !r.loaded) && !isOffline);

  const [secondsAgo, setSecondsAgo] = useState(0);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataSignature = `${totalRounds}:${activeRounds}:${totalPool}:${totalProjects}`;

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
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Seconds since the last data change
  useEffect(() => {
    const resetFrame = requestAnimationFrame(() => setSecondsAgo(0));
    const interval = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => { cancelAnimationFrame(resetFrame); clearInterval(interval); };
  }, [dataSignature]);

  const animatedRounds = useCountUp(totalRounds, 800, inView);
  const animatedPool = useCountUp(totalPool, 800, inView);
  const animatedProjects = useCountUp(totalProjects, 800, inView);

  const [tick, setTick] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const frame = requestAnimationFrame(() => setTick(true));
    const timer = setTimeout(() => setTick(false), 250);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [dataSignature, inView]);

  const handleScrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const columns: Column[] = [
    {
      key: "rounds",
      icon: <Layers className="h-4 w-4 text-muted" />,
      label: isVi ? "VÒNG TÀI TRỢ" : "FUNDING ROUNDS",
      value: animatedRounds,
      caption: isVi ? "Tổng số vòng đã tạo" : "Total rounds created",
      badge: activeRounds > 0 ? `${activeRounds} ${isVi ? "ĐANG MỞ" : "OPEN"}` : undefined,
      onClick: () => router.push("/rounds"),
      visual: (
        <div className="flex h-6 items-center gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => {
            const round = rounds[i];
            const cls = !round
              ? "border border-white/20 bg-transparent group-hover:border-white/40"
              : round.active
                ? "bg-primary shadow-[0_0_6px_rgba(232,65,66,0.5)]"
                : "bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]";
            return <span key={i} className={`h-2 w-2 rounded-full transition-all duration-300 ${cls}`} style={{ transitionDelay: `${i * 30}ms` }} />;
          })}
        </div>
      ),
      footer: totalRounds === 0
        ? (isVi ? "Chưa có vòng nào" : "No rounds yet")
        : `${activeRounds} ${isVi ? "đang mở" : "open"} · ${totalRounds - activeRounds} ${isVi ? "đã kết thúc" : "ended"}`,
    },
    {
      key: "pool",
      icon: <Coins className="h-4 w-4 text-muted" />,
      label: isVi ? "QUỸ ĐỐI ỨNG" : "MATCHING POOL",
      value: animatedPool,
      unit: "USDC",
      caption: isVi ? "Tổng quỹ đối ứng của mọi vòng" : "Total matching pool across all rounds",
      badge: totalPool > 0 ? "ACTIVE" : undefined,
      onClick: () => handleScrollTo("current-round"),
      visual: (
        <div className="flex h-6 w-full items-center gap-[3px]">
          {rounds.length === 0
            ? Array.from({ length: 20 }).map((_, i) => <span key={i} className="h-1 flex-1 rounded-[1px] bg-white/12" />)
            : rounds.map((r, i) => (
              <span
                key={i}
                title={`${formatNumber(Math.round(r.pool))} USDC`}
                className={`h-1 rounded-[1px] transition-all duration-300 ${r.pool > 0 ? "bg-primary shadow-[0_0_4px_rgba(232,65,66,0.6)]" : "bg-white/12"}`}
                style={{ flex: Math.max(0.15, r.pool / maxPool) }}
              />
            ))}
        </div>
      ),
      footer: totalPool === 0
        ? <span className="font-medium tracking-wide text-primary">{isVi ? "CHỜ NẠP TIỀN ĐẦU TIÊN" : "AWAITING FIRST DEPOSIT"}</span>
        : `${totalRounds} ${isVi ? "vòng" : "rounds"} · ${isVi ? "mỗi đoạn là một vòng" : "one segment per round"}`,
    },
    {
      key: "projects",
      icon: <Rocket className="h-4 w-4 text-muted" />,
      label: isVi ? "DỰ ÁN" : "PROJECTS",
      value: animatedProjects,
      caption: isVi ? "Dự án đã đăng ký ở mọi vòng" : "Projects registered across all rounds",
      badge: totalProjects > 0 ? `${totalProjects} ACTIVE` : undefined,
      onClick: () => handleScrollTo("projects-list"),
      visual: (
        <div className="flex h-6 items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-[2px] transition-all duration-300 ${i < totalProjects
                ? "border border-primary bg-primary/20 shadow-[0_0_6px_rgba(232,65,66,0.3)] group-hover:scale-110"
                : "border border-dashed border-white/20 bg-transparent group-hover:border-white/40"}`}
              style={{ transitionDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      ),
      footer: rounds.filter((r) => r.projects > 0).length > 0
        ? `${rounds.filter((r) => r.projects > 0).length}/${totalRounds} ${isVi ? "vòng có dự án" : "rounds have projects"}`
        : (isVi ? "Chưa có dự án" : "No projects yet"),
    },
  ];

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative overflow-hidden rounded-[4px] border border-white/12 bg-surface text-white shadow-2xl transition-all duration-300">
        <span aria-hidden="true" className="pointer-events-none absolute -top-[1px] -left-[1px] z-30 h-2 w-2 border-t-2 border-l-2 border-primary" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-[1px] -right-[1px] z-30 h-2 w-2 border-t-2 border-r-2 border-primary" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-[1px] -left-[1px] z-30 h-2 w-2 border-b-2 border-l-2 border-primary" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-[1px] -right-[1px] z-30 h-2 w-2 border-b-2 border-r-2 border-primary" />

        <div className="relative z-10 flex h-8 items-center justify-between border-b border-white/12 bg-white/[0.02] px-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            {isOffline ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="font-semibold tracking-[0.08em] text-primary">{isVi ? "OFFLINE · ĐANG THỬ LẠI" : "OFFLINE · RETRYING"}</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-money" />
                <span className="font-semibold tracking-[0.08em] text-muted">LIVE</span>
              </>
            )}
          </div>
          <div className="tracking-[0.05em] text-muted">
            <span>{isVi ? `CẬP NHẬT ${secondsAgo}S TRƯỚC` : `UPDATED ${secondsAgo}S AGO`}</span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 divide-y divide-white/12 md:grid-cols-3 md:divide-y-0 md:divide-x">
          {columns.map((col) => (
            <div
              key={col.key}
              role="button"
              tabIndex={0}
              onClick={col.onClick}
              onKeyDown={(e) => e.key === "Enter" && col.onClick()}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden p-6 transition-all duration-300 hover:bg-white/[0.015] lg:p-8"
            >
              <div className="pointer-events-none absolute inset-0 z-20 border border-transparent transition-colors duration-300 group-hover:border-primary/60" />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-6 -right-4 z-0 hidden select-none font-mono text-[140px] font-black leading-none text-white/[0.03] lg:block lg:text-[180px] xl:text-[200px]"
              >
                {col.value}
              </span>

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  {col.icon}
                  <span>{col.label}</span>
                </div>
                {col.badge && (
                  <span className="rounded-[2px] border border-money/40 bg-money/10 px-1.5 py-0.5 font-mono text-xs tracking-wider text-money">{col.badge}</span>
                )}
              </div>

              <div className="relative z-10 my-4 sm:my-6">
                <div
                  className={`flex items-baseline font-mono text-4xl font-bold leading-none tracking-[-0.03em] tabular-nums text-white transition-transform duration-250 sm:text-5xl lg:text-7xl xl:text-8xl ${tick ? "translate-y-2 opacity-80" : "translate-y-0 opacity-100"}`}
                >
                  <span>{isLoading ? "—" : formatNumber(col.value)}</span>
                  {col.unit && <span className="ml-2 font-mono text-lg font-normal tracking-normal text-muted lg:text-xl">{col.unit}</span>}
                </div>
                <p className="mt-2 text-sm text-muted">{col.caption}</p>
              </div>

              <div className="relative z-10 mt-auto border-t border-white/[0.06] pt-3">
                {col.visual}
                <div className="mt-2 font-mono text-xs text-muted">{col.footer}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

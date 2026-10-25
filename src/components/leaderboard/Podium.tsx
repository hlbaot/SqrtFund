"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { isAddress, type Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { ArrowUpRight, Coins } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { SupporterMarks } from "@/components/project/SupporterMarks";
import { AnimatedNumber, InfoTooltip } from "./Primitives";
import { MatchingMetric, RankBadge, TotalMetric } from "./ProjectMetrics";
import { Stat, StatGroup } from "@/components/common/Stat";
import { Dialog } from "@/components/ui/Dialog";
import type { RankedProject } from "./model";

const DonateBox = dynamic(
  () => import("@/components/project/DonateBox").then((m) => m.DonateBox),
  { ssr: false }
);

export function Podium({
  projects,
  roundId,
  pool,
  finalized,
  canDonate,
}: {
  projects: RankedProject[];
  roundId: string;
  pool: number;
  finalized: boolean;
  canDonate?: boolean;
}) {
  const { t, locale } = useLocale();
  const { address } = useAccount();
  const [donatingProject, setDonatingProject] = useState<RankedProject | null>(null);
  const targetRoundAddress = roundId && isAddress(roundId) ? (roundId as Address) : undefined;

  const top = projects.slice(0, 3);
  const maxSupporters = Math.max(0, ...top.map(project => project.supporterCount));
  const markScale = maxSupporters <= 25 ? 1 : Math.max(5, Math.ceil(maxSupporters / 36 / 5) * 5);

  const donationContracts = useMemo(() => {
    if (!targetRoundAddress || !address || top.length === 0) return [];
    return top.map((p) => ({
      address: targetRoundAddress,
      abi: qfRoundAbi,
      functionName: "donationOf" as const,
      args: [address, BigInt(p.id || "1")] as const,
    }));
  }, [targetRoundAddress, address, top]);

  const { data: donationsData } = useReadContracts({
    contracts: donationContracts,
    query: {
      enabled: Boolean(donationContracts.length > 0),
      refetchInterval: 5000,
    },
  });

  const donatedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!donationsData) return map;
    top.forEach((p, idx) => {
      const amt = donationsData[idx]?.result as bigint | undefined;
      if (amt && amt > 0n) {
        map.set(p.id, true);
      }
    });
    return map;
  }, [donationsData, top]);

  if (!top.length) return null;

  return (
    <section className="hidden min-w-0 lg:block" aria-label={t.competition.topProjects}>
      <div className={`mx-auto grid max-w-6xl items-end gap-4 ${top.length === 1 ? "max-w-md grid-cols-1" : top.length === 2 ? "max-w-3xl grid-cols-2" : "grid-cols-3"}`}>
        {top.map((project, index) => {
          const hasDonated = Boolean(donatedMap.get(project.id));
          const isOwner = Boolean(address && project.ownerAddress && address.toLowerCase() === project.ownerAddress.toLowerCase());
          const isDonatable = (canDonate !== undefined ? canDonate : !finalized) && project.status !== "pending" && project.status !== "rejected" && !hasDonated && !isOwner;

          return (
            <article
              key={project.id}
              data-zero={project.supporterCount === 0}
              className={`relative min-w-0 bg-surface p-6 ${project.supporterRank === 1 ? "gradient-border pt-9" : "border border-line"} ${top.length === 3 ? index === 0 ? "lg:order-2" : index === 1 ? "lg:order-1" : "lg:order-3" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <RankBadge project={project} large />
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <span className="mono-label text-[11px] text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-xs">
                      {locale === "vi" ? "Dự án của bạn" : "Your project"}
                    </span>
                  )}
                  {hasDonated && (
                    <span className="mono-label text-[11px] text-money border border-money/30 bg-money/10 px-2 py-0.5 rounded-xs">
                      ✓ {t.donateBox.alreadyDonatedBadge}
                    </span>
                  )}
                  <span className="role-label">{t.competition.rank}</span>
                </div>
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

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setDonatingProject(project)}
                  disabled={isOwner}
                  className={`mono-label w-full flex min-h-10 items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold transition-all rounded-xs ${
                    isOwner
                      ? "border border-line bg-surface text-muted cursor-not-allowed opacity-60"
                      : hasDonated
                        ? "border border-money/40 bg-money/10 text-money cursor-pointer active:scale-[0.98]"
                        : "border border-money text-money bg-money/5 hover:bg-money/15 cursor-pointer active:scale-[0.98]"
                  }`}
                >
                  <Coins className="h-3.5 w-3.5 shrink-0 text-money" />
                  <span>
                    {isOwner
                      ? (locale === "vi" ? "Dự án của bạn" : "Your project")
                      : hasDonated
                        ? `✓ ${t.donateBox.alreadyDonatedBadge}`
                        : t.competition.donateToMe}
                  </span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {donatingProject && (
        <Dialog
          isOpen={Boolean(donatingProject)}
          onClose={() => setDonatingProject(null)}
          title={t.projectCard.quickDonateTitle.replace("{name}", donatingProject.name)}
          className="max-w-xl p-0 overflow-hidden"
        >
          <div className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <DonateBox
              project={donatingProject}
              roundAddress={targetRoundAddress}
            />
            <div className="border-t border-line pt-3 flex items-center justify-between">
              <span className="mono-label text-[11px] text-muted">
                {t.projectCard.viewFullDetails}:
              </span>
              <Link
                href={`/round/${roundId}/project/${donatingProject.id}`}
                onClick={() => setDonatingProject(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <span>{donatingProject.name}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

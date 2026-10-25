"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { isAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import type { Project } from "@/types";
import { formatUsdc, formatUsdcFixed } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { SupporterMarks } from "./SupporterMarks";
import { Stat, StatGroup } from "@/components/common/Stat";
import { Badge } from "@/components/ui/Badge";
import { Frame } from "@/components/ui/Frame";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { Dialog } from "@/components/ui/Dialog";
import { ArrowRight, Sparkles, BookOpen, Cpu, Leaf, Music, Coins } from "lucide-react";

const DonateBox = dynamic(
  () => import("@/components/project/DonateBox").then((m) => m.DonateBox),
  { ssr: false }
);

export interface ProjectCardProps {
  project: Project & {
    sumSqrtRaw?: bigint;
    totalDonatedRaw?: bigint;
    contractId?: bigint;
  };
  roundId?: string;
  roundAddress?: Address;
  canDonate?: boolean;
  imageLayout?: "banner" | "square";
}

export function ProjectCard({
  project,
  roundId = "1",
  roundAddress,
  canDonate,
  imageLayout = "banner",
}: ProjectCardProps) {
  const { t, locale } = useLocale();
  const { address } = useAccount();
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [prevImg, setPrevImg] = useState(project.imageUrl);
  if (prevImg !== project.imageUrl) {
    setPrevImg(project.imageUrl);
    setImageFailed(false);
  }

  const targetRoundAddress =
    roundAddress ||
    (roundId && isAddress(roundId) ? (roundId as Address) : undefined);

  // Read how much current user has already donated to this project
  const projectIdBigInt = BigInt(project.id || project.contractId?.toString() || "1");
  const { data: userDonatedData } = useReadContract({
    address: targetRoundAddress,
    abi: qfRoundAbi,
    functionName: "donationOf",
    args: address && targetRoundAddress ? [address, projectIdBigInt] : undefined,
    query: {
      enabled: Boolean(targetRoundAddress && address),
      refetchInterval: 5000,
    },
  });
  const isOwner = Boolean(address && project.ownerAddress && address.toLowerCase() === project.ownerAddress.toLowerCase());
  const hasAlreadyDonated = Boolean(userDonatedData && (userDonatedData as bigint) > 0n);

  const isDonatable =
    (canDonate !== undefined
      ? canDonate && project.status !== "pending" && project.status !== "rejected"
      : project.status !== "pending" && project.status !== "rejected") && !hasAlreadyDonated && !isOwner;

  const name = locale === "vi" && project.nameVi ? project.nameVi : project.name;
  const shortDescription =
    locale === "vi" && project.shortDescriptionVi
      ? project.shortDescriptionVi
      : project.shortDescription;

  // Visual category icons
  const CategoryIcon = {
    education: BookOpen,
    technology: Cpu,
    environment: Leaf,
    arts: Music,
  }[project.category] || Sparkles;

  const categoryLabels = {
    education: locale === "vi" ? "Giáo dục" : "Education",
    technology: locale === "vi" ? "Công nghệ" : "Technology",
    environment: locale === "vi" ? "Môi trường" : "Environment",
    arts: locale === "vi" ? "Nghệ thuật" : "Arts",
  };

  const content = (
    <Frame
      className="group relative flex h-full flex-col justify-between overflow-hidden p-5"
      interactive
    >
      {/* 5. Rank Badge (top corner overlay) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {project.rank && (
            <Badge variant={project.rank === 1 ? "primary" : "secondary"}>
              #{project.rank}
            </Badge>
          )}
          <span className="mono-label flex items-center gap-1 text-muted">
            <CategoryIcon className="h-3.5 w-3.5 text-muted" />
            <span>{categoryLabels[project.category]}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isOwner && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              {locale === "vi" ? "Dự án của bạn" : "Your project"}
            </Badge>
          )}
          {hasAlreadyDonated && (
            <Badge variant="accent" className="text-[10px] bg-money/15 text-money border-money/30">
              ✓ {t.donateBox.alreadyDonatedBadge}
            </Badge>
          )}
          {(project.status === "pending" || project.status === "rejected") && (
            <Badge variant={project.status === "rejected" ? "primary" : "warning"}>{project.status === "rejected" ? t.rejection.status : t.myActivity.statusPending}</Badge>
          )}
        </div>
      </div>

      {/* 1. Image placeholder area, name, short description */}
      <div>
        <div className={`relative mb-4 flex w-full items-center justify-center overflow-hidden border border-line bg-bg ${imageLayout === "square" ? "mx-auto aspect-square max-w-[200px]" : "h-32"}`}>
          {project.imageUrl && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={project.imageUrl}
              src={project.imageUrl}
              alt={name}
              onError={() => setImageFailed(true)}
              className={imageLayout === "square" ? "absolute inset-0 h-full w-full object-contain" : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-4">
              <CategoryIcon className="mb-1 h-8 w-8 text-primary" />
              <MonoLabel>
                {categoryLabels[project.category]}
              </MonoLabel>
            </div>
          )}
        </div>

        <h3 className="line-clamp-1 text-lg font-bold tracking-tight text-foreground">
          {name}
        </h3>
        <p className="mt-1.5 min-h-8 line-clamp-2 text-xs leading-relaxed text-muted">
          {shortDescription}
        </p>
      </div>

      {/* 2. Number of supporters (most emphasized with SupporterMarks) */}
      <div className="my-4">
        <SupporterMarks count={project.supporterCount} />
      </div>

      {/* 3. USDC Donated & 4. Estimated Matching */}
      <StatGroup columns={2} className="my-3">
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
      </StatGroup>

      {/* Action Buttons */}
      <div className="mt-4 pt-1 flex items-center gap-2">
        <Link
          href={`/round/${roundId}/project/${project.id}`}
          className={`mono-label ${isDonatable ? "flex-1" : "w-full"} flex min-h-10 items-center justify-center gap-1.5 border border-line-strong bg-surface py-2 px-3 text-xs text-muted transition-all hover:border-line hover:bg-surface-2 hover:text-foreground cursor-pointer active:scale-[0.98] focus:outline-none rounded-xs`}
        >
          <span>{t.projectCard.viewDetails}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>

        {isDonatable && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDonateOpen(true);
            }}
            className="mono-label flex-1 flex min-h-10 items-center justify-center gap-1.5 border border-primary bg-primary text-white font-bold py-2 px-3 text-xs transition-all hover:bg-primary-hover cursor-pointer active:scale-[0.98] focus:outline-none rounded-xs shadow-xs"
          >
            <Coins className="h-3.5 w-3.5 shrink-0" />
            <span>{t.projectCard.donate}</span>
          </button>
        )}
      </div>
    </Frame>
  );

  return (
    <>
      {project.rank === 1 ? (
        <GradientBorder className="h-full p-px">
          {content}
        </GradientBorder>
      ) : (
        content
      )}

      {isDonateOpen && (
        <Dialog
          isOpen={isDonateOpen}
          onClose={() => setIsDonateOpen(false)}
          title={t.projectCard.quickDonateTitle.replace("{name}", name)}
          className="max-w-xl p-0 overflow-hidden"
        >
          <div className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <DonateBox
              project={project}
              roundAddress={targetRoundAddress}
            />
            <div className="border-t border-line pt-3 flex items-center justify-between">
              <span className="mono-label text-[11px] text-muted">
                {locale === "vi" ? "Đóng góp trực tiếp qua Smart Contract" : "Direct on-chain quadratic donation"}
              </span>
              <Link
                href={`/round/${roundId}/project/${project.id}`}
                onClick={() => setIsDonateOpen(false)}
                className="mono-label text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{t.projectCard.viewFullDetails}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

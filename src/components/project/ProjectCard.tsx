"use client";

import React from "react";
import Link from "next/link";
import type { Project } from "@/types";
import { formatUsdc, formatUsdcFixed } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { SupporterMarks } from "./SupporterMarks";
import { Stat, StatGroup } from "@/components/common/Stat";
import { Badge } from "@/components/ui/Badge";
import { Frame } from "@/components/ui/Frame";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { ArrowRight, Sparkles, BookOpen, Cpu, Leaf, Music } from "lucide-react";

export interface ProjectCardProps {
  project: Project;
  roundId?: string;
}

export function ProjectCard({ project, roundId = "1" }: ProjectCardProps) {
  const { t, locale } = useLocale();

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

        {(project.status === "pending" || project.status === "rejected") && (
          <Badge variant={project.status === "rejected" ? "primary" : "warning"}>{project.status === "rejected" ? t.rejection.status : t.myActivity.statusPending}</Badge>
        )}
      </div>

      {/* 1. Image placeholder area, name, short description */}
      <div>
        <div className="relative mb-4 flex h-32 w-full items-center justify-center overflow-hidden border border-line bg-bg p-4">
          <div className="flex flex-col items-center justify-center text-center">
            <CategoryIcon className="mb-1 h-8 w-8 text-primary" />
            <MonoLabel>
              {categoryLabels[project.category]}
            </MonoLabel>
          </div>
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

      {/* Primary Action */}
      <div className="mt-4 pt-1">
        <Link
          href={`/round/${roundId}/project/${project.id}`}
          className="mono-label flex w-full items-center justify-center gap-1.5 border border-line-strong bg-surface py-2.5 text-muted transition-colors hover:border-primary hover:bg-surface-2 hover:text-foreground focus:outline-none"
        >
          <span>{t.projectCard.viewDetails}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Frame>
  );

  return project.rank === 1 ? (
    <GradientBorder className="h-full p-px">
      {content}
    </GradientBorder>
  ) : (
    content
  );
}

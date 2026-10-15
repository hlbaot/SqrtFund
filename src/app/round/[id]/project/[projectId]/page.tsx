"use client";

import { Suspense } from "react";
import { ProjectDetailView } from "@/views/project-detail";
import { ProjectDetailSkeleton } from "@/components/common/PageSkeletons";

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      <ProjectDetailView />
    </Suspense>
  );
}

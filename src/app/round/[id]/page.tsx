"use client";

import { Suspense } from "react";
import { RoundDetailView } from "@/views/round-detail";
import { RoundDetailSkeleton } from "@/components/common/PageSkeletons";

export default function RoundPage() {
  return (
    <Suspense fallback={<RoundDetailSkeleton />}>
      <RoundDetailView />
    </Suspense>
  );
}

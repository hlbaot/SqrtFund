import { Suspense } from "react";
import { RoundDetailView } from "@/views/round-detail";
import { RoundDetailSkeleton } from "@/components/common/PageSkeletons";
import { pageMetadata } from "@/lib/seo.server";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return pageMetadata("detail", `/round/${encodeURIComponent(id)}`);
}

export default function RoundPage() {
  return (
    <Suspense fallback={<RoundDetailSkeleton />}>
      <RoundDetailView />
    </Suspense>
  );
}

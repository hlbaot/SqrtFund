import { Suspense } from "react";
import { ProjectDetailView } from "@/views/project-detail";
import { ProjectDetailSkeleton } from "@/components/common/PageSkeletons";
import { pageMetadata } from "@/lib/seo.server";
export async function generateMetadata({ params }: { params: Promise<{ id: string; projectId: string }> }) {
  const { id, projectId } = await params;
  return pageMetadata("detail", `/round/${encodeURIComponent(id)}/project/${encodeURIComponent(projectId)}`);
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      <ProjectDetailView />
    </Suspense>
  );
}

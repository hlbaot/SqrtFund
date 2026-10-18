import { Container } from "@/components/layout/Container";
import { HomeSkeleton, RoundDetailSkeleton, AdminSkeleton, MyActivitySkeleton } from "./PageSkeletons";
import { Skeleton } from "@/components/ui/Skeleton";

export function RouteLoading({ kind = "list" }: { kind?: "home" | "round" | "admin" | "my" | "list" | "form" }) {
  return <Container role="status" aria-label="Loading page / Đang tải trang" className="w-full py-8 sm:py-10">
    {kind === "home" ? <HomeSkeleton /> : kind === "round" ? <RoundDetailSkeleton /> : kind === "admin" ? <AdminSkeleton /> : kind === "my" ? <MyActivitySkeleton /> : <div className="space-y-6"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-5 w-3/4" /><div className={kind === "form" ? "max-w-2xl space-y-4" : "grid gap-4 md:grid-cols-2"}>{Array.from({ length: kind === "form" ? 3 : 6 }, (_, index) => <Skeleton key={index} className={kind === "form" ? "h-14" : "h-36"} />)}</div></div>}
  </Container>;
}

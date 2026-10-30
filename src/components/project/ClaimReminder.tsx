"use client";
import type { Project } from "@/types";
import { useClaimTiming } from "@/hooks/useClaimTiming";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useLocale } from "@/lib/context/locale";
import { claimWindow, isClaimOverdue } from "@/lib/claimWindow";
import { roundDate } from "@/components/leaderboard/model";
export function ClaimOverdueBadge({ project }: { project: Project }) {
  const now = useCurrentTimestamp(); const { locale } = useLocale();
  return isClaimOverdue(project, now) ? <span className="mt-1 inline-block border border-primary/40 px-2 py-1 text-xs text-primary">{locale === "vi" ? "Quá hạn nhận kinh phí" : "Recommended claim date passed"}</span> : null;
}
export function ClaimReminder({ project, round, finalized, cancelled }: { project: Project; round?: string; finalized: boolean; cancelled: boolean }) {
  const { locale } = useLocale(); const vi = locale === "vi"; const now = useCurrentTimestamp();
  const eligible = finalized && !cancelled && project.status === "approved" && project.claimed === false && project.finalMatching !== undefined && project.totalDonated + project.finalMatching > 0;
  const timing = useClaimTiming(round, eligible && project.finalizedAt === undefined);
  if (!eligible) return null;
  const window = claimWindow({ ...project, fundingState: "finalized", finalizedAt: project.finalizedAt ?? timing.data?.finalizedAt }, now);
  return <div className="space-y-1 border border-line bg-bg p-3 text-xs" role="status">
    {window ? <><p className={window.stage === "overdue" ? "font-semibold text-primary" : "font-semibold"}>{window.stage === "overdue" ? (vi ? "Quá hạn nhận kinh phí" : "Recommended claim date passed") : (vi ? `Còn ${window.daysRemaining} ngày đến mốc khuyến nghị` : `${window.daysRemaining} days until the recommended date`)}</p><p>{vi ? "Khuyến nghị nhận trước ngày" : "Recommended claim date"}: <time dateTime={new Date(window.deadline * 1000).toISOString()}>{roundDate(new Date(window.deadline * 1000).toISOString(), locale)} (GMT+7)</time></p></> : <p>{vi ? "Chưa xác minh được thời điểm finalize để tính mốc nhận tiền. Không áp dụng hạ vị trí khi chưa đủ dữ liệu." : "Finalization time is not yet confirmed. No visibility penalty is applied while timing is unknown."}</p>}
    <p className="text-muted">{vi ? "Mốc khuyến nghị là 30 ngày sau finalize. Bạn vẫn có thể claim muộn; tiền và kết quả phân bổ không thay đổi." : "The recommended date is 30 days after finalization. Late claims remain available; funds and allocations do not change."}</p>
  </div>;
}

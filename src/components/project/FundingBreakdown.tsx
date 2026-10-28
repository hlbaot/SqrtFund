"use client";
import type { Project } from "@/types";
import { projectFunding } from "@/lib/projectFunding";
import { formatUsdcFixed } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
export function FundingBreakdown({
  project,
  finalized = project.fundingState === "finalized",
  cancelled = project.fundingState === "cancelled",
  compact = false,
}: {
  project: Project;
  finalized?: boolean;
  cancelled?: boolean;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const amounts = projectFunding(project, finalized, cancelled);
  const labels = [
    vi ? "Tiền góp trực tiếp" : "Direct contributions",
    finalized
      ? vi
        ? "Matching đã chốt"
        : "Final matching"
      : vi
        ? "Matching dự kiến"
        : "Estimated matching",
    cancelled
      ? vi
        ? "Không giải ngân — round đã hủy"
        : "No payout — round cancelled"
      : finalized
        ? vi
          ? "Tổng đã chốt"
          : "Final total"
        : vi
          ? "Tổng dự kiến nhận"
          : "Estimated total",
  ];
  return (
    <section
      aria-label={vi ? "Phân bổ tài trợ" : "Funding breakdown"}
      className="space-y-2"
    >
      <dl
        className={
          compact
            ? "grid grid-cols-2 gap-3"
            : "grid grid-cols-1 gap-3 sm:grid-cols-3"
        }
      >
        {[
          amounts.direct,
          amounts.matching,
          cancelled ? undefined : amounts.total,
        ].map((value, i) => (
          <div
            key={labels[i]}
            className={`border border-line p-3 ${i === 2 ? `bg-money/10 ${compact ? "col-span-2" : ""}` : "bg-bg"}`}
          >
            <dt className="text-xs text-muted">{labels[i]}</dt>
            <dd className="mt-1 break-words font-mono font-semibold">
              {value === undefined ? "—" : formatUsdcFixed(value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        {cancelled
          ? vi
            ? "Người đã góp nhận lại khoản của mình qua hoàn tiền."
            : "Contributors can refund their own contributions."
          : finalized
            ? vi
              ? "Tiền góp trực tiếp + matching đã chốt. Chủ dự án nhận tiền bằng thao tác claim."
              : "Direct contributions + settled matching. The project owner must claim the funds."
            : vi
              ? "Tổng dự kiến = tiền góp trực tiếp + matching dự kiến. Matching còn thay đổi đến khi round được chốt; đây chưa phải số tiền đã nhận."
              : "Estimated total = direct contributions + estimated matching. Matching can change until settlement; these funds have not yet been received."}
      </p>
    </section>
  );
}

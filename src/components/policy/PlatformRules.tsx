"use client";

import Link from "next/link";
import { useLocale } from "@/lib/context/locale";
import { CRITERIA, RULES_VERSION, type Criterion } from "@/lib/roundGovernance";
import {
  ShieldCheck,
  GraduationCap,
  Users,
  Target,
  Compass,
  Coins,
  FileCheck2,
  Gavel,
  Lock,
  Sparkles,
  ExternalLink,
  Calendar,
  Check,
  X,
} from "lucide-react";

export function PlatformRules({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const vi = locale === "vi";

  const criteriaIcons: Record<Criterion, typeof Target> = {
    fit: Target,
    impact: Users,
    feasibility: Compass,
    budget: Coins,
    integrity: FileCheck2,
  };

  const doItems = vi
    ? [
        "Nêu rõ vấn đề thực tế, đối tượng hưởng lợi, kế hoạch triển khai và nhu cầu kinh phí cụ thể.",
        "Cung cấp thông tin trung thực, tài liệu có bản quyền hợp pháp và kênh liên hệ đang hoạt động.",
        "Chuẩn bị bảng dự toán ngân sách chi tiết và các mốc kết quả đo lường được (liên kết tài liệu khi mô tả ngắn không đủ).",
        "Hoàn thiện hồ sơ công khai sau khi được duyệt và minh bạch cập nhật tiến độ sử dụng vốn sau khi nhận tài trợ.",
      ]
    : [
        "Clearly explain the real problem, beneficiaries, feasible roadmap, and concrete funding needs.",
        "Provide truthful information, content you have the legal right to use, and active contact channels.",
        "Prepare an itemized budget breakdown and measurable milestones via linked documents when the summary is insufficient.",
        "Finalize the public project profile upon approval and proactively report fund usage updates after disbursement.",
      ];

  const dontItems = vi
    ? [
        "Không giả mạo danh tính, sao chép dự án hoặc sử dụng nội dung, hình ảnh trái phép.",
        "Không tạo tài khoản giả mạo (Sybil) hoặc phối hợp đóng góp ảo để thao túng quỹ đối ứng.",
        "Chủ dự án tuyệt đối không tự quyên góp cho dự án của mình (được kiểm tra tự động bởi Smart Contract).",
        "Không vi phạm các chuẩn mực nội dung; các tiêu chí chất lượng do Organizer trực tiếp đánh giá.",
      ]
    : [
        "Do not impersonate others, plagiarize projects, or use copyrighted media without permission.",
        "Do not create fake accounts (Sybil attacks) or coordinate collusive contributions to manipulate matching.",
        "Project owners cannot donate to their own projects (strictly enforced on-chain by the Smart Contract).",
        "Do not violate platform guidelines; content suitability is assessed directly by the Round Organizer.",
      ];

  return (
    <section
      className={`space-y-6 rounded-xl border border-line bg-surface/95 p-5 shadow-sm transition-all sm:p-7 ${
        compact ? "space-y-5 p-4 sm:p-6" : ""
      }`}
      aria-label={vi ? "Quy định chung" : "Platform rules"}
    >
      {/* Header section */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {vi ? "Quy định chung của SqrtFund" : "SqrtFund Platform Rules"}
            </h2>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              {vi
                ? "Bộ quy chuẩn, điều kiện tham gia và tiêu chí xét duyệt trên toàn nền tảng"
                : "Standard guidelines, eligibility, and review criteria across the platform"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>
              {vi ? "Phiên bản" : "Version"} {RULES_VERSION}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <Lock className="h-3 w-3" />
            <span>On-chain Enforced</span>
          </span>
        </div>
      </div>

      {/* Điều kiện tham gia */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {vi ? "Điều kiện tham gia" : "Eligibility & Requirements"}
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-line-strong">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 font-mono text-[11px] text-primary">
                1
              </span>
              <span>{vi ? "Ví Student xác thực" : "Verified Student Wallet"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {vi
                ? "Cần ví Student đã ghi danh trên blockchain sau khi xác minh email trường (.edu / .edu.vn)."
                : "Student wallet enrolled on-chain after academic school email verification."}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-line-strong">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 font-mono text-[11px] text-primary">
                2
              </span>
              <span>{vi ? "Giới hạn dự án" : "Application Cap"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {vi
                ? "Mỗi ví được đăng ký tối đa 2 dự án/vòng (kể cả dự án từng bị từ chối)."
                : "Up to 2 projects per wallet per round (including previously rejected entries)."}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-line-strong">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 font-mono text-[11px] text-primary">
                3
              </span>
              <span>{vi ? "Quy mô vòng gọi vốn" : "Round Capacity"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {vi
                ? "Mỗi vòng tiếp nhận tối đa 50 dự án. Hãy đọc thêm điều kiện riêng của từng round trước khi nộp."
                : "Maximum 50 projects per funding round. Check round-specific rules before applying."}
            </p>
          </div>
        </div>
      </div>

      {/* Tiêu chí xét duyệt chung */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {vi ? "Tiêu chí xét duyệt chung" : "Common Review Criteria"}
          </h3>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(CRITERIA[locale]) as [Criterion, string][]).map(
            ([key, label], idx) => {
              const Icon = criteriaIcons[key] || Target;
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-3.5 py-2.5 transition-colors hover:border-primary/40 hover:bg-surface-2/70"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-mono text-[11px] text-muted">
                      {vi ? "Tiêu chí" : "Criterion"} 0{idx + 1}
                    </span>
                    <span
                      className="line-clamp-1 text-xs font-medium text-foreground sm:text-sm"
                      title={label}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Do & Don't */}
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {/* Do's */}
        <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-4.5 sm:p-5">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 sm:text-base">
              <Check className="h-5 w-5 rounded-full bg-emerald-500/20 p-0.5" />
              <span>{vi ? "Nên làm" : "Do"}</span>
            </div>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              {vi ? "Khuyến khích" : "Recommended"}
            </span>
          </div>

          <ul className="space-y-2.5 text-xs text-foreground/90 sm:text-sm">
            {doItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Don'ts */}
        <div className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-950/10 p-4.5 sm:p-5">
          <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-400 sm:text-base">
              <X className="h-5 w-5 rounded-full bg-rose-500/20 p-0.5" />
              <span>{vi ? "Không được làm" : "Do not"}</span>
            </div>
            <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
              {vi ? "Nghiêm cấm" : "Prohibited"}
            </span>
          </div>

          <ul className="space-y-2.5 text-xs text-foreground/90 sm:text-sm">
            {dontItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                <X className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quy trình và kết quả xét duyệt (Full Mode Only) */}
      {!compact && (
        <div className="space-y-4 border-t border-line pt-6">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground sm:text-lg">
              {vi ? "Quy trình và kết quả xét duyệt" : "Review Process & Outcomes"}
            </h3>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
                <Gavel className="h-4 w-4 shrink-0 text-amber-400" />
                <span>{vi ? "Quyết định từ Organizer" : "Organizer Review"}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {vi
                  ? "Organizer của round quyết định duyệt hoặc từ chối theo quy định chung và tiêu chí đã công bố. Lý do được công khai kèm các tiêu chí liên quan và giao dịch đã xác nhận. Nếu giao dịch thành công nhưng lưu lời giải thích thất bại, trạng thái blockchain vẫn giữ nguyên; giao diện hiển thị chưa có giải thích."
                  : "The round organizer approves or rejects projects against platform rules and published criteria. Explanations are public with relevant criteria and a confirmed transaction. If the transaction succeeds but saving its explanation fails, on-chain status remains unchanged and the explanation is shown as unavailable."}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
                <Lock className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{vi ? "Quyết định chung cuộc" : "Final On-Chain Outcome"}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {vi
                  ? "Từ chối trên blockchain là quyết định cuối cùng cho mã dự án đó, không thể duyệt lại và không trả lại suất đăng ký. Hãy liên hệ Organizer qua kênh round/dự án để làm rõ trước khi có quyết định cuối cùng. Nền tảng chưa có quy trình khiếu nại hay trạng thái yêu cầu bổ sung hồ sơ."
                  : "On-chain rejection is final for that project ID: it cannot be approved again and still counts toward registration limits. Clarify questions with the organizer before a final decision. There is currently no formal appeal or request-for-changes workflow."}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{vi ? "Cơ chế Quỹ đối ứng" : "Quadratic Matching"}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {vi
                  ? "Quỹ đối ứng phụ thuộc công thức, ngân sách và trần của round; được duyệt không bảo đảm mức tài trợ. Bản hiện tại dùng Fuji/MockUSDC để thử nghiệm."
                  : "Matching depends on the formula, pool and round cap; approval does not guarantee funding. This version uses Fuji/MockUSDC for testing."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer link in Compact Mode */}
      {compact && (
        <div className="border-t border-line pt-3">
          <Link
            href="/rules"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline sm:text-sm"
          >
            <span>{vi ? "Đọc quy định đầy đủ (mở tab mới)" : "Read full rules (new tab)"}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}

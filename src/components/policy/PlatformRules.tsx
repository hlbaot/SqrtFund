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

  const criteriaDescriptions: Record<Criterion, { vi: string; en: string }> = {
    fit: {
      vi: "Đúng định hướng của đợt tài trợ, có đối tượng thụ hưởng cụ thể và thực tế.",
      en: "Aligns with the round focus and addresses a specific, identifiable audience.",
    },
    impact: {
      vi: "Tạo ra giá trị hữu ích, giải quyết vấn đề thiết thực cho cộng đồng sinh viên.",
      en: "Creates meaningful positive impact and solves real problems for the community.",
    },
    feasibility: {
      vi: "Kế hoạch từng bước rõ ràng, có thời hạn và mục tiêu hoàn thành đo lường được.",
      en: "Clear milestone roadmap with realistic timelines and measurable outcomes.",
    },
    budget: {
      vi: "Dự toán chi tiêu hợp lý, minh bạch và giải trình chi tiết từng khoản cần dùng.",
      en: "Transparent, sensible budget with itemized cost estimates for each activity.",
    },
    integrity: {
      vi: "Thông tin trung thực, không sao chép và có quyền sở hữu hợp pháp với toàn bộ nội dung.",
      en: "Accurate information, zero plagiarism, and full legal rights to all submitted content.",
    },
  };

  const doItems = vi
    ? [
        "Trình bày rõ vấn đề thực tế, đối tượng thụ hưởng, các bước thực hiện và số tiền cần hỗ trợ.",
        "Cung cấp thông tin trung thực, hình ảnh và tài liệu có bản quyền, kèm kênh liên hệ thực tế.",
        "Lập bảng dự toán chi tiêu rõ ràng, mốc kết quả cụ thể (kèm liên kết tài liệu nếu cần).",
        "Hoàn thiện hồ sơ công khai khi được duyệt và chủ động cập nhật tiến độ sử dụng tiền sau khi nhận tài trợ.",
      ]
    : [
        "Clearly explain the real-world problem, beneficiaries, implementation steps, and concrete funding needs.",
        "Provide truthful information, legitimate and permitted media, and an active contact channel.",
        "Prepare a clear budget breakdown and measurable milestones (attach document links if needed).",
        "Keep project details up to date after approval and proactively share progress on how funds are used.",
      ];

  const dontItems = vi
    ? [
        "Không mạo danh người khác, sao chép dự án hoặc sử dụng nội dung, hình ảnh chưa xin phép.",
        "Không tạo nhiều tài khoản ảo hoặc phối hợp đóng góp gian lận để trục lợi quỹ tài trợ.",
        "Chủ dự án tuyệt đối không tự góp tiền cho dự án của mình (hệ thống sẽ tự động ngăn chặn).",
        "Không vi phạm chuẩn mực cộng đồng; Ban tổ chức đợt tài trợ sẽ trực tiếp đánh giá chất lượng hồ sơ.",
      ]
    : [
        "Do not impersonate others, plagiarize projects, or use unauthorized images and content.",
        "Do not create multiple fake accounts or collude with others to manipulate the funding pool.",
        "Project creators cannot donate to their own project (the system will automatically block this).",
        "Do not violate community standards; the round organizers will directly review proposal quality.",
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
                ? "Bộ quy chuẩn, điều kiện tham gia và tiêu chí xét duyệt dành cho các dự án"
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
            <Check className="h-3 w-3" />
            <span>{vi ? "Quy tắc bắt buộc" : "Mandatory Rules"}</span>
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
              <span>{vi ? "Xác thực sinh viên" : "Verified Student"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {vi
                ? "Cần tài khoản sinh viên đã xác minh bằng email của trường đại học (.edu / .edu.vn)."
                : "Requires a verified student account using an academic school email (.edu)."}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-line-strong">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 font-mono text-[11px] text-primary">
                2
              </span>
              <span>{vi ? "Giới hạn đăng ký" : "Application Cap"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {vi
                ? "Mỗi người được đăng ký tối đa 2 dự án trong một đợt (kể cả dự án bị từ chối)."
                : "Up to 2 project submissions per round (including previously rejected entries)."}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-line-strong">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 font-mono text-[11px] text-primary">
                3
              </span>
              <span>{vi ? "Quy mô mỗi đợt" : "Round Capacity"}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {vi
                ? "Mỗi đợt nhận tối đa 50 dự án. Hãy xem kỹ điều kiện riêng của từng đợt trước khi nộp."
                : "Maximum 50 projects per funding round. Check round-specific rules before applying."}
            </p>
          </div>
        </div>
      </div>

      {/* Tiêu chí xét duyệt chung */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {vi ? "Tiêu chí xét duyệt chung" : "Common Review Criteria"}
            </h3>
          </div>
          <span className="text-xs text-muted">
            {vi ? "5 tiêu chí đánh giá" : "5 core criteria"}
          </span>
        </div>

        {/* Cân đối 2 cột: 4 thẻ 2x2 + thẻ thứ 5 trải rộng cả 2 cột */}
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.entries(CRITERIA[locale]) as [Criterion, string][]).map(
            ([key, label], idx) => {
              const Icon = criteriaIcons[key] || Target;
              const desc = criteriaDescriptions[key]?.[locale] ?? "";
              const isLast = idx === 4;

              return (
                <div
                  key={key}
                  className={`group rounded-xl border border-line bg-surface-2/40 p-3.5 transition-all hover:border-primary/40 hover:bg-surface-2/70 ${
                    isLast ? "sm:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-primary transition-colors group-hover:border-primary/40">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted">
                          {vi ? "Tiêu chí" : "Criterion"} 0{idx + 1}
                        </span>
                        {isLast && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {vi ? "Tiêu chuẩn bắt buộc" : "Mandatory Standard"}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-0.5 text-xs font-semibold text-foreground sm:text-sm">
                        {label}
                      </h4>
                      {desc && (
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {desc}
                        </p>
                      )}
                    </div>
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
                <span>{vi ? "Đánh giá từ Ban tổ chức" : "Organizer Review"}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {vi
                  ? "Ban tổ chức sẽ duyệt hoặc từ chối dự án dựa trên quy định chung và tiêu chí của từng đợt. Mọi kết quả và lý do đánh giá đều được công khai minh bạch để người nộp và cộng đồng cùng theo dõi."
                  : "The round organizers approve or reject projects based on platform rules and published criteria. Review explanations are publicly visible for transparency."}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
                <Lock className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{vi ? "Quyết định là chung cuộc" : "Final Outcome"}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {vi
                  ? "Khi dự án đã có kết quả từ chối, quyết định này là cuối cùng, không thể mở lại và không hoàn lại lượt nộp. Hãy chủ động trao đổi với Ban tổ chức nếu cần làm rõ thông tin trước khi có kết quả."
                  : "Once a rejection is confirmed, the decision is final and cannot be reopened. Please reach out to the organizer beforehand if you have questions."}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{vi ? "Phân bổ tiền tài trợ" : "Matching Fund Distribution"}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {vi
                  ? "Số tiền tài trợ cộng thêm phụ thuộc vào số lượng người ủng hộ và ngân sách chung của đợt; dự án được duyệt không bảo đảm nhận đủ 100% mức mong muốn. (Phiên bản hiện tại đang chạy thử nghiệm)."
                  : "Additional matching funds depend on community backing and round budget; approval does not guarantee a fixed funding amount. (Currently in testnet mode)."}
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

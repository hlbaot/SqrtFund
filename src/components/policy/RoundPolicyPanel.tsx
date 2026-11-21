"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { CATEGORY_IDS, CATEGORY_LABELS } from "@/lib/projectCategories";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useRoundGovernance, usePublishGovernance } from "@/hooks/useRoundGovernance";
import { RULES_VERSION, type RoundPolicy } from "@/lib/roundGovernance";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { Button } from "@/components/ui/Button";

const fields = ["theme", "eligibility", "funding", "criteria"] as const;
const fieldLabels = {
  vi: {
    theme: "Chủ đề và mục tiêu vòng",
    eligibility: "Đối tượng và điều kiện tham gia",
    funding: "Phạm vi kinh phí được hỗ trợ",
    criteria: "Tiêu chí đánh giá cụ thể",
  },
  en: {
    theme: "Round theme and goals",
    eligibility: "Eligibility and participation",
    funding: "Eligible funding expenses",
    criteria: "Specific review criteria",
  },
};

export function RoundPolicyPanel({ roundAddress, readOnly = false, onPublished, onSetupLocked }: {
  roundAddress: Address;
  readOnly?: boolean;
  onPublished?: () => void;
  onSetupLocked?: () => void;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const query = useRoundGovernance(roundAddress);
  const round = useRound(roundAddress);
  const { address, chainId, isConnected } = useAccount();
  const publish = usePublishGovernance();
  const [policy, setPolicy] = useState<RoundPolicy>({ theme: "", eligibility: "", funding: "", criteria: "", categories: [...CATEGORY_IDS] });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const record = query.data?.find(r => r.kind === "policy");
  const published = record?.payload.kind === "policy" ? record.payload.policy : undefined;
  const owner = Boolean(!readOnly && isConnected && chainId === TARGET_CHAIN_ID && address && address.toLowerCase() === round.admin?.toLowerCase());
  const locked = round.projectCount !== 0n || round.finalized || round.isCancelled || round.status !== "open";
  const canPublish = owner && !round.isLoading && !round.isError && !locked;
  const title = vi ? "Điều kiện và tiêu chí xét duyệt" : "Eligibility and review criteria";
  const categories = policy.categories ?? CATEGORY_IDS;
  const canSubmit = categories.length > 0 && fields.every(field => policy[field].trim());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !canPublish || !canSubmit || published) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await publish({ kind: "policy", round: roundAddress, rulesVersion: RULES_VERSION, policy });
      onPublished?.();
    } catch (error) {
      if (error instanceof Error && ["POLICY_LOCKED", "GOVERNANCE_ALREADY_PUBLISHED"].includes(error.message)) {
        setError(vi ? "Vòng đã có dự án, đã đóng hoặc đã có quy định. Đang cập nhật trạng thái." : "The round is locked or already has rules. Refreshing its status.");
        round.refetch?.();
        void query.refetch();
      } else {
        setError(vi ? "Chưa lưu được quy định. Nội dung đã nhập vẫn còn. Bạn có thể ký và thử lại." : "Could not save the rules. Your input is retained. You can sign and retry.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-sm border border-line bg-surface p-5" aria-label={title}>
      <h2 className="font-bold">{title}</h2>
      <Link href="/rules" target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
        {vi ? "Quy định chung của nền tảng ↗" : "Platform rules ↗"}
      </Link>
      {query.isLoading ? <p role="status">{vi ? "Đang tải tiêu chí…" : "Loading criteria…"}</p> : query.isError ? (
        <div role="alert">
          <p className="text-sm">{vi ? "Chưa đọc được tiêu chí. Vui lòng thử lại; không thể xác nhận round có tiêu chí riêng hay chưa." : "Criteria unavailable. Retry to confirm the round's published requirements."}</p>
          <Button type="button" variant="ghost" onClick={() => void query.refetch()}>{vi ? "Thử lại" : "Retry"}</Button>
        </div>
      ) : published ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            {fields.map(field => <div key={field} className="min-w-0">
              <dt className="text-xs text-muted">{fieldLabels[locale][field]}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{published[field]}</dd>
            </div>)}
          </dl>
          <p className="text-xs text-muted">{vi ? "Đã ký công bố và khóa chỉnh sửa" : "Signed and locked after publication"} · {new Date(record!.created_at).toLocaleString(vi ? "vi-VN" : "en-US")}</p>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{vi ? "Lĩnh vực được tham gia" : "Eligible categories"}</h3>
            <div className="flex flex-wrap gap-2">{(published.categories ?? CATEGORY_IDS).map(id => <span key={id} className="border border-line px-2 py-1 text-xs">{CATEGORY_LABELS[locale][id]}</span>)}</div>
            <p className="text-xs text-muted">{vi ? "Các lĩnh vực trong cùng round dùng chung quỹ đối ứng. Tạo round riêng nếu cần ngân sách độc lập." : "Categories in the same round share its matching pool. Create separate rounds for independent budgets."}</p>
          </div>
          {owner && onPublished && <Button type="button" onClick={onPublished}>{vi ? "Hoàn tất tạo vòng" : "Finish round setup"}</Button>}
        </>
      ) : (
        <>
          {!onPublished && <p className="text-sm text-muted">{vi ? "Organizer chưa công bố tiêu chí riêng cho round này. Quy định chung vẫn áp dụng; hãy làm rõ yêu cầu với Organizer trước khi nộp." : "The organizer has not published round-specific criteria. Platform rules still apply; clarify requirements with the organizer before applying."}</p>}
          {onPublished && round.isLoading && <p role="status" className="text-sm text-muted">{vi ? "Đang xác nhận trạng thái vòng trên Fuji…" : "Checking the round on Fuji…"}</p>}
          {onPublished && round.isError && <Button type="button" variant="ghost" onClick={() => round.refetch()}>{vi ? "Tải lại trạng thái vòng" : "Retry round status"}</Button>}
          {canPublish && <form className="space-y-3 border-t border-line pt-4" onSubmit={submit}>
            <p className="text-xs text-muted">{vi ? "Nội dung được công khai và khóa chỉnh sửa sau khi ký." : "The rules become public and are locked after signing."}</p>
            <fieldset disabled={busy} className="space-y-4">
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold">{vi ? "Lĩnh vực được tham gia (chọn ít nhất một)" : "Eligible categories (choose at least one)"}</legend>
                {CATEGORY_IDS.map(id => <label key={id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={categories.includes(id)} onChange={event => {
                    const checked = event.target.checked;
                    setPolicy(previous => ({ ...previous, categories: checked ? [...(previous.categories ?? CATEGORY_IDS), id] : (previous.categories ?? CATEGORY_IDS).filter(category => category !== id) }));
                  }} />
                  {CATEGORY_LABELS[locale][id]}
                </label>)}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(field => <label key={field} className="block text-sm">
                  {fieldLabels[locale][field]}
                  <textarea required maxLength={field === "criteria" ? 4000 : 2000} rows={3} value={policy[field]}
                    onChange={event => {
                      const value = event.currentTarget.value;
                      setPolicy(previous => ({ ...previous, [field]: value }));
                    }} className="mt-1 w-full border border-line bg-bg p-2" />
                </label>)}
              </div>
              <Button type="submit" isLoading={busy} disabled={!canSubmit}>
                {onPublished ? (vi ? "Ký và hoàn tất tạo vòng" : "Sign and finish round setup") : (vi ? "Ký và công bố tiêu chí" : "Sign and publish criteria")}
              </Button>
            </fieldset>
          </form>}
          {error && <p role="alert" className="text-sm text-primary">{error}</p>}
          {owner && !canPublish && <p className="text-xs text-muted">{vi ? "Không thể công bố tiêu chí mới khi round đã có dự án, đã kết thúc hoặc chưa xác nhận được trạng thái." : "New criteria cannot be published after projects exist, the round ends or its state cannot be confirmed."}</p>}
          {onSetupLocked && owner && locked && !round.isLoading && !round.isError && (
            <Button type="button" variant="secondary" onClick={onSetupLocked}>{vi ? "Rời thiết lập vòng này" : "Leave this round setup"}</Button>
          )}
        </>
      )}
    </section>
  );
}

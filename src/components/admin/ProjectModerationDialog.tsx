"use client";
import { ReviewCriteria } from "@/components/policy/ReviewOutcomePanel";
import type { ReviewNote, Criterion } from "@/lib/roundGovernance";
import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import type { Project } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import { shortAddress } from "@/lib/format";
import { safeProjectLink, type ModerationAction } from "@/lib/projectModeration";
import { StatusAlert } from "@/components/ui/StatusAlert";

export function ProjectModerationDialog({ project, action, roundName, roundAddress, pending, phase, blockedReason, error, onClose, onConfirm }: {
  project: Pick<Project, "name" | "ownerAddress" | "description" | "contactUrl">; action: ModerationAction;
  roundName?: string; roundAddress?: string; pending: boolean; phase: "idle" | "signing" | "confirming";
  blockedReason?: string; error?: string; onClose: () => void; onConfirm: (note: Pick<ReviewNote, "criteria" | "reason">) => void;
}) {
  const { t, locale } = useLocale(); const c = t.moderation;
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [reason, setReason] = useState("");
  const [copyResult, setCopyResult] = useState("");
  const closeState = useRef({ pending, onClose });
  closeState.current = { pending, onClose };
  // Keep Dialog's focus-trap effect stable while the page clock updates each second.
  const close = useCallback(() => { if (!closeState.current.pending) closeState.current.onClose(); }, []);
  const link = safeProjectLink(project.contactUrl);
  async function copyOwner() {
    try { await navigator.clipboard.writeText(project.ownerAddress); setCopyResult(t.wallet.copied); }
    catch { setCopyResult(c.copyFailed); }
  }
  return <Dialog isOpen onClose={close} title={action === "approve" ? c.approveTitle : c.rejectTitle}>
    <dl className="space-y-3 text-sm">
      <div><dt className="text-xs text-muted">{c.projectName}</dt><dd className="break-words font-semibold">{project.name}</dd></div>
      <div><dt className="text-xs text-muted">{c.owner}</dt><dd>
        <div className="flex flex-wrap items-center gap-2"><span title={project.ownerAddress} className="font-mono">{shortAddress(project.ownerAddress)}</span><Button type="button" variant="ghost" size="sm" onClick={() => void copyOwner()} aria-label={`${t.common.copyAddress}: ${project.ownerAddress}`}>{t.common.copyAddress}</Button></div>
        <p className="break-all font-mono text-xs text-muted">{project.ownerAddress}</p><p aria-live="polite" className="text-xs">{copyResult}</p>
      </dd></div>
      <div><dt className="text-xs text-muted">{c.description}</dt><dd className="break-words whitespace-pre-wrap">{project.description.slice(0, 280)}</dd></div>
      <div><dt className="text-xs text-muted">{c.link}</dt><dd className="break-all">{link ? <a href={link} target="_blank" rel="noopener noreferrer" className="underline">{project.contactUrl}</a> : project.contactUrl || "—"}</dd></div>
      <div><dt className="text-xs text-muted">{c.round}</dt><dd className="break-words font-semibold">{roundName || "—"}</dd><dd title={roundAddress} className="break-all font-mono text-xs text-muted">{roundAddress || "—"}</dd></div>
    </dl>
    <p className={`mt-4 border p-3 text-sm ${action === "reject" ? "border-primary/50 bg-primary/10 text-primary" : "border-money/40 bg-money/10 text-money"}`}>{action === "approve" ? c.approveWarning : t.rejection.confirm}</p>
    <div className="mt-4 space-y-3">
      <Link href={roundAddress ? `/round/${roundAddress}` : "/rules"} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{locale === "vi" ? "Đọc quy định và tiêu chí round ↗" : "Read rules and round criteria ↗"}</Link>
      <ReviewCriteria value={criteria} onChange={setCriteria} disabled={pending} />
      <label className="block text-sm">{locale === "vi" ? "Lý do công khai (bắt buộc)" : "Public explanation (required)"}<textarea disabled={pending} maxLength={2000} rows={3} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full border border-line bg-surface p-2" /></label>
      <p className="text-xs text-muted">{locale === "vi" ? "Sau giao dịch, ví sẽ ký thêm để lưu lời giải thích công khai. Không nhập thông tin cá nhân chưa được đồng ý. Nếu lưu thất bại, có thể bổ sung lý do từ chi tiết dự án mà không gửi lại giao dịch." : "After the transaction, sign again to save the public explanation. Avoid private personal information. If saving fails, publish the explanation from project details without repeating the transaction."}</p>
    </div>
    {blockedReason && <StatusAlert tone="warning" className="mt-3" title={blockedReason} />}
    {error && <p role="alert" className="mt-3 break-words text-sm text-primary">{error}</p>}
    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" disabled={pending} onClick={onClose}>{t.common.cancel}</Button>
      <Button variant={action === "approve" ? "accent" : "destructive"} disabled={pending || Boolean(blockedReason) || criteria.length === 0 || !reason.trim()} title={blockedReason || (pending ? c.busy : undefined)} isLoading={pending} onClick={() => onConfirm({ criteria, reason: reason.trim() })}>
        {pending ? (phase === "signing" ? c.signing : c.confirming) : action === "approve" ? c.confirmApprove : c.confirmReject}
      </Button>
    </div>
  </Dialog>;
}

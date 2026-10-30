"use client";
import { useState } from "react";
import { useLocale } from "@/lib/context/locale";
import { useAccount } from "wagmi";
import { useRound } from "@/hooks/useRound";
import { usePublishGovernance, useRoundGovernance } from "@/hooks/useRoundGovernance";
import { CRITERIA, RULES_VERSION, type Criterion } from "@/lib/roundGovernance";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import type { Address } from "viem";
import { Button } from "@/components/ui/Button";
export function ReviewOutcomePanel({ roundAddress, projectId, approved, rejected }: { roundAddress: Address; projectId: string; approved?: boolean; rejected?: boolean }) {
  const { locale } = useLocale(); const vi = locale === "vi";
  const query = useRoundGovernance(roundAddress); const round = useRound(roundAddress);
  const { address, chainId, isConnected } = useAccount(); const publish = usePublishGovernance();
  const [reason, setReason] = useState(""); const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [hash, setHash] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const record = query.data?.find(r => r.payload.kind === "review" && r.payload.review.projectId === projectId);
  const note = record?.payload.kind === "review" ? record.payload.review : undefined;
  const matches = note && ((note.action === "approve" && approved) || (note.action === "reject" && rejected));
  if (!approved && !rejected) return null;
  const owner = isConnected && chainId === TARGET_CHAIN_ID && address?.toLowerCase() === round.admin?.toLowerCase();
  return <section className="space-y-3 border-t border-line pt-4" aria-label={vi ? "Lý do xét duyệt" : "Review explanation"}>
    <h3 className="font-semibold">{vi ? "Lý do xét duyệt" : "Review explanation"}</h3>
    {query.isLoading ? <p role="status">{vi ? "Đang tải…" : "Loading…"}</p> : query.isError ? <div role="alert"><p>{vi ? "Không đọc được lời giải thích. Trạng thái xét duyệt vẫn lấy từ blockchain." : "Explanation unavailable. Review status still comes from the blockchain."}</p><Button type="button" variant="ghost" onClick={() => void query.refetch()}>{vi ? "Thử lại" : "Retry"}</Button></div> : matches ? <>
      <p className="text-xs text-muted">{note.criteria.map(c => CRITERIA[locale][c]).join(" · ")}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{note.reason}</p>
      <p className="text-xs text-muted">{vi ? "Organizer công bố" : "Published by organizer"} · {new Date(record!.created_at).toLocaleString(vi ? "vi-VN" : "en-US")}</p>
      <a className="text-xs text-primary underline" href={`https://testnet.snowtrace.io/tx/${record!.transaction_hash}`} target="_blank" rel="noopener noreferrer">{vi ? "Xem giao dịch xét duyệt ↗" : "View review transaction ↗"}</a>
    </> : <><p className="text-sm text-muted">{vi ? "Chưa có lời giải thích được xác nhận cho quyết định này." : "No confirmed explanation has been published for this decision."}</p>
      {owner && !record && <form className="space-y-3" onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError("");
        try { await publish({ kind: "review", round: roundAddress, rulesVersion: RULES_VERSION, review: { projectId, action: rejected ? "reject" : "approve", criteria, reason } }, hash); }
        catch { setError(vi ? "Chưa lưu được. Kiểm tra giao dịch đúng round/dự án và thử lại. Nội dung vẫn được giữ." : "Not saved. Check the transaction belongs to this round/project and retry. Input is retained."); }
        finally { setBusy(false); }
      }}><p className="text-xs text-muted">{vi ? "Organizer: bổ sung lời giải thích cho quyết định đã có. Không gửi lại giao dịch duyệt/từ chối." : "Organizer: publish the explanation for an existing decision without repeating the transaction."}</p><fieldset disabled={busy} className="space-y-3"><ReviewCriteria value={criteria} onChange={setCriteria} /><label className="block text-sm">{vi ? "Giải thích công khai" : "Public explanation"}<textarea required maxLength={2000} rows={3} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full border border-line bg-bg p-2" /></label><label className="block text-sm">{vi ? "Hash giao dịch xét duyệt đã xác nhận" : "Confirmed review transaction hash"}<input required pattern="0x[0-9a-fA-F]{64}" value={hash} onChange={e => setHash(e.target.value)} className="mt-1 w-full border border-line bg-bg p-2" /></label><Button type="submit" disabled={criteria.length === 0} isLoading={busy}>{vi ? "Ký và công bố lý do" : "Sign and publish explanation"}</Button></fieldset>{error && <p role="alert" className="text-sm text-primary">{error}</p>}</form>}
    </>}
  </section>;
}
export function ReviewCriteria({ value, onChange, disabled }: { value: Criterion[]; onChange: (value: Criterion[]) => void; disabled?: boolean }) {
  const { locale } = useLocale();
  return <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-semibold">{locale === "vi" ? "Tiêu chí liên quan (chọn ít nhất một)" : "Relevant criteria (select at least one)"}</legend>{(Object.entries(CRITERIA[locale]) as [Criterion, string][]).map(([id, label]) => <label key={id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={value.includes(id)} onChange={e => onChange(e.target.checked ? [...value, id] : value.filter(c => c !== id))} />{label}</label>)}</fieldset>;
}

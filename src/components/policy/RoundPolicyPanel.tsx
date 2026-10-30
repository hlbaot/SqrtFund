"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useRoundGovernance, usePublishGovernance } from "@/hooks/useRoundGovernance";
import { RULES_VERSION, type RoundPolicy } from "@/lib/roundGovernance";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { Button } from "@/components/ui/Button";
import type { Address } from "viem";
export function RoundPolicyPanel({ roundAddress }: { roundAddress: Address }) {
  const { locale } = useLocale(); const vi = locale === "vi";
  const query = useRoundGovernance(roundAddress);
  const round = useRound(roundAddress);
  const { address, chainId, isConnected } = useAccount();
  const publish = usePublishGovernance();
  const [policy, setPolicy] = useState<RoundPolicy>({ theme: "", eligibility: "", funding: "", criteria: "" });
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState("");
  const record = query.data?.find(r => r.kind === "policy");
  const published = record?.payload.kind === "policy" ? record.payload.policy : undefined;
  const owner = isConnected && chainId === TARGET_CHAIN_ID && address?.toLowerCase() === round.admin?.toLowerCase();
  const canPublish = owner && !round.isLoading && !round.isError && round.projectCount === 0n && !round.finalized && !round.isCancelled && round.status === "open";
  const labels: Record<keyof RoundPolicy, string> = vi ? { theme: "Chủ đề và mục tiêu vòng", eligibility: "Đối tượng và điều kiện tham gia", funding: "Phạm vi kinh phí được hỗ trợ", criteria: "Tiêu chí đánh giá cụ thể" } : { theme: "Round theme and goals", eligibility: "Eligibility and participation", funding: "Eligible funding expenses", criteria: "Specific review criteria" };
  return <section className="space-y-4 rounded-sm border border-line bg-surface p-5" aria-label={vi ? "Điều kiện và tiêu chí xét duyệt" : "Eligibility and review criteria"}>
    <h2 className="font-bold">{vi ? "Điều kiện và tiêu chí xét duyệt" : "Eligibility and review criteria"}</h2>
    <Link href="/rules" target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{vi ? "Quy định chung của nền tảng ↗" : "Platform rules ↗"}</Link>
    {query.isLoading ? <p role="status">{vi ? "Đang tải tiêu chí…" : "Loading criteria…"}</p> : query.isError ? <div role="alert"><p className="text-sm">{vi ? "Chưa đọc được tiêu chí. Vui lòng thử lại; không thể xác nhận round có tiêu chí riêng hay chưa." : "Criteria unavailable. Retry to confirm the round's published requirements."}</p><Button type="button" variant="ghost" onClick={() => void query.refetch()}>{vi ? "Thử lại" : "Retry"}</Button></div> : <>
      {published ? <><dl className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([field, label]) => <div key={field} className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{published[field as keyof RoundPolicy]}</dd></div>)}</dl><p className="text-xs text-muted">{vi ? "Đã ký công bố và khóa chỉnh sửa" : "Signed and locked after publication"} · {new Date(record!.created_at).toLocaleString(vi ? "vi-VN" : "en-US")}</p></> : <p className="text-sm text-muted">{vi ? "Organizer chưa công bố tiêu chí riêng cho round này. Quy định chung vẫn áp dụng; hãy làm rõ yêu cầu với Organizer trước khi nộp." : "The organizer has not published round-specific criteria. Platform rules still apply; clarify requirements with the organizer before applying."}</p>}
      {!published && canPublish && <form key={roundAddress} className="space-y-3 border-t border-line pt-4" onSubmit={async e => {
        e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError("");
        try { await publish({ kind: "policy", round: roundAddress, rulesVersion: RULES_VERSION, policy }); }
        catch (e) { setError(e instanceof Error && ["POLICY_LOCKED", "GOVERNANCE_ALREADY_PUBLISHED"].includes(e.message) ? (vi ? "Round đã có dự án hoặc tiêu chí đã được công bố. Tải lại để xem trạng thái mới." : "The round already has projects or a published policy. Reload for the latest state.") : (vi ? "Chưa lưu được tiêu chí. Dữ liệu nhập vẫn được giữ; kiểm tra cấu hình/migration hoặc thử lại." : "Criteria were not saved. Input is retained; check configuration/migration or retry.")); }
        finally { lock.current = false; setBusy(false); }
      }}><p className="text-xs text-muted">{vi ? "Chỉ công bố trước khi có dự án đầu tiên. Nội dung công khai và không thể sửa sau khi lưu. Không đăng thông tin cá nhân chưa được đồng ý." : "Publish before the first project. Content is public and cannot be edited after saving. Do not include private personal information."}</p><fieldset disabled={busy} className="space-y-3">{Object.entries(labels).map(([field, label]) => <label key={field} className="block text-sm">{label}<textarea required maxLength={field === "criteria" ? 4000 : 2000} rows={3} value={policy[field as keyof RoundPolicy]} onChange={e => setPolicy(p => ({ ...p, [field]: e.target.value }))} className="mt-1 w-full border border-line bg-bg p-2" /></label>)}<Button type="submit" isLoading={busy}>{vi ? "Ký và công bố tiêu chí" : "Sign and publish criteria"}</Button></fieldset>{error && <p role="alert" className="text-sm text-primary">{error}</p>}</form>}
      {!published && owner && !canPublish && <p className="text-xs text-muted">{vi ? "Không thể công bố tiêu chí mới khi round đã có dự án, đã kết thúc hoặc chưa xác nhận được trạng thái." : "New criteria cannot be published after projects exist, the round ends or its state cannot be confirmed."}</p>}
    </>}
  </section>;
}

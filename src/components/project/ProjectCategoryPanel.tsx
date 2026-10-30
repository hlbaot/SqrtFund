"use client";
import { useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import type { Project } from "@/types";
import { useLocale } from "@/lib/context/locale";
import { usePublishGovernance, useRoundGovernance } from "@/hooks/useRoundGovernance";
import { CATEGORY_IDS, CATEGORY_LABELS, CATEGORY_GUIDANCE, isFundingCategory } from "@/lib/projectCategories";
import { RULES_VERSION } from "@/lib/roundGovernance";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { Button } from "@/components/ui/Button";
export function ProjectCategoryPanel({ project, roundAddress }: { project: Project; roundAddress: Address }) {
  const { locale } = useLocale(); const vi = locale === "vi";
  const { address, isConnected, chainId } = useAccount();
  const query = useRoundGovernance(roundAddress); const publish = usePublishGovernance();
  const [selected, setSelected] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const policyRecord = query.data?.find(r => r.payload.kind === "policy");
  const allowed = policyRecord?.payload.kind === "policy" ? policyRecord.payload.policy.categories ?? CATEGORY_IDS : CATEGORY_IDS;
  const categoryRecord = query.data?.find(r => r.payload.kind === "category" && r.payload.projectId === project.id);
  const category = categoryRecord?.payload.kind === "category" ? categoryRecord.payload.category : undefined;
  const owner = isConnected && chainId === TARGET_CHAIN_ID && address?.toLowerCase() === project.ownerAddress.toLowerCase();
  return <section className="space-y-3 border-t border-line pt-4" aria-label={vi ? "Lĩnh vực dự án" : "Project category"}>
    <h2 className="font-semibold">{vi ? "Lĩnh vực dự án" : "Project category"}</h2>
    {query.isLoading ? <p role="status" className="text-sm">{vi ? "Đang tải lĩnh vực…" : "Loading category…"}</p> : query.isError ? <div role="alert"><p className="text-sm text-muted">{vi ? "Chưa đọc được lĩnh vực đã lưu. Vui lòng thử lại." : "The saved category could not be loaded. Please retry."}</p><Button variant="ghost" onClick={() => void query.refetch()}>{vi ? "Thử lại" : "Retry"}</Button></div> : category ? <><span className="inline-block border border-line px-3 py-1 text-sm">{CATEGORY_LABELS[locale][category]}</span><p className="text-xs text-muted">{CATEGORY_GUIDANCE[locale][category]}</p><p className="text-xs text-muted">{vi ? "Lĩnh vực do chủ dự án ký công bố." : "Category signed and published by the project owner."}</p></> : <>
      <p className="text-sm text-muted">{vi ? "Chưa phân loại. Chủ dự án có thể chọn một lĩnh vực chính; dự án cũ không được tự gán lĩnh vực." : "Uncategorized. The owner can select one primary category; existing projects are not automatically classified."}</p>
      {owner && <form className="space-y-3" onSubmit={async e => {
        e.preventDefault(); if (lock.current || !isFundingCategory(selected) || !allowed.includes(selected)) return;
        lock.current = true; setBusy(true); setError("");
        try { await publish({ kind: "category", round: roundAddress, rulesVersion: RULES_VERSION, projectId: project.id, category: selected }); }
        catch (e) { setError(e instanceof Error && e.message === "CATEGORY_NOT_ALLOWED" ? (vi ? "Lĩnh vực không thuộc phạm vi round này." : "This category is outside the round's scope.") : (vi ? "Chưa lưu được lĩnh vực. Lựa chọn vẫn được giữ; hãy thử lại hoặc tải lại nếu đã công bố ở phiên khác." : "Category not saved. Your selection is retained; retry or reload if already published elsewhere.")); }
        finally { lock.current = false; setBusy(false); }
      }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">{vi ? "Chọn một lĩnh vực chính" : "Choose one primary category"}<select required className="mt-1 min-h-11 w-full border border-line bg-bg p-2" value={selected} onChange={e => setSelected(e.target.value)}><option value="">{vi ? "Chọn lĩnh vực…" : "Select a category…"}</option>{allowed.map(id => <option key={id} value={id}>{CATEGORY_LABELS[locale][id]}</option>)}</select></label>{isFundingCategory(selected) && <p className="text-xs text-muted">{CATEGORY_GUIDANCE[locale][selected]}</p>}<p className="text-xs text-muted">{vi ? "Công bố một lần bằng chữ ký ví, không chuyển tiền. Lĩnh vực không thể chỉnh sửa sau khi lưu; hãy kiểm tra trước khi xác nhận." : "Publish once with a wallet signature; no funds are transferred. The category cannot be edited after saving; check before confirming."}</p><Button type="submit" isLoading={busy} disabled={!selected}>{vi ? "Ký và lưu lĩnh vực" : "Sign and save category"}</Button></fieldset>{error && <p role="alert" className="text-sm text-primary">{error}</p>}</form>}
    </>}
  </section>;
}

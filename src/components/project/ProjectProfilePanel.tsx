"use client";
import { useState, useRef, type FormEvent } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import type { Project } from "@/types";
import { useLocale } from "@/lib/context/locale";
import { useTxFlow } from "@/hooks/useTxFlow";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import {
  EMPTY_PROFILE,
  PROFILE_TTL,
  parseProfileChange,
  profileMessage,
  type ProfileDocument,
  type ProjectProfile,
  type ProfilePermit,
} from "@/lib/projectProfile";
import { SponsorInterest } from "@/components/project/SponsorInterest";
import { Button } from "@/components/ui/Button";
async function loadProfile(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const x = await r.json();
  if (!r.ok) throw Error(x.code ?? "PROFILE_UNAVAILABLE");
  return x.document as ProfileDocument | null;
}
export function ProjectProfilePanel({
  project,
  roundAddress,
}: {
  project: Project & { claimed?: boolean };
  roundAddress?: Address;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const { address, chainId, isConnected } = useAccount();
  const enabled = Boolean(roundAddress && project.status === "approved");
  const key = [
    "project-profile",
    TARGET_CHAIN_ID,
    roundAddress?.toLowerCase(),
    project.id,
  ];
  const query = useQuery({
    queryKey: key,
    enabled,
    queryFn: () =>
      loadProfile(
        `/api/project-profile?round=${roundAddress}&projectId=${project.id}`,
      ),
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const doc = query.data;
  const owner =
    isConnected &&
    address?.toLowerCase() === project.ownerAddress.toLowerCase() &&
    chainId === TARGET_CHAIN_ID;
  const labels: Record<keyof ProjectProfile, string> = {
    leadName: vi ? "Người phụ trách" : "Project lead",
    goal: vi ? "Vấn đề, mục tiêu và người hưởng lợi" : "Problem, goal and beneficiaries",
    differentiator: vi ? "Điểm khác biệt của giải pháp (không bắt buộc)" : "What makes the solution different (optional)",
    progress: vi ? "Sản phẩm mẫu và kết quả hiện tại (không bắt buộc)" : "Prototype and progress so far (optional)",
    budgetUsdc: vi ? "Ngân sách đề xuất (USDC)" : "Requested budget (USDC)",
    budgetPlan: vi ? "Kế hoạch sử dụng ngân sách" : "Budget breakdown",
    milestones: vi
      ? "Mốc triển khai và cách đo kết quả"
      : "Milestones and success measures",
  };
  if (!enabled)
    return (
      <p className="text-xs text-muted">
        {vi
          ? "Sau khi dự án được duyệt, chủ ví có thể bổ sung hồ sơ và kế hoạch ngân sách tại đây."
          : "After approval, the project owner can publish the proposal and budget here."}
      </p>
    );
  return (
    <section
      className="space-y-4 border-t border-line pt-4"
      aria-label={vi ? "Điểm nổi bật của dự án" : "Project highlights"}
    >
      <h2 className="font-bold">
        {vi ? "Điểm nổi bật của dự án" : "Project highlights"}
      </h2>
      {query.isLoading ? (
        <p role="status">{vi ? "Đang tải hồ sơ…" : "Loading proposal…"}</p>
      ) : query.isError ? (
        <div role="alert" className="text-sm">
          <p>
            {vi
              ? "Chưa đọc được hồ sơ đã lưu. Nội dung chưa được xác nhận; vui lòng thử lại."
              : "The saved proposal is unavailable. Its contents could not be confirmed; please retry."}
          </p>
          <Button variant="ghost" onClick={() => void query.refetch()}>
            {vi ? "Thử lại" : "Retry"}
          </Button>
        </div>
      ) : (
        <>
          {doc ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {Object.entries(labels).map(([field, label]) => (
                <div key={field} className="min-w-0 rounded-sm border border-line bg-bg p-4">
                  <dt className="text-xs text-muted">{label.replace(vi ? " (không bắt buộc)" : " (optional)", "")}</dt>
                  <dd className="whitespace-pre-line break-words text-sm">
                    {doc.profile[field as keyof ProjectProfile] || (vi ? "Nhóm chưa cập nhật" : "Not yet provided by the team")}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">
              {vi
                ? "Chủ dự án chưa công bố người phụ trách, ngân sách và mốc triển khai. Bạn có thể liên hệ nhóm trước khi quyết định góp."
                : "The team has not published a lead, budget or milestones yet. Contact them before deciding to contribute."}
            </p>
          )}
          <p className="text-xs text-muted">
            {vi
              ? "Nội dung do ví chủ dự án công bố; ngân sách đề xuất không phải cam kết matching hay khoản đã nhận."
              : "Published by the project owner's wallet. The requested budget is neither guaranteed matching nor funds received."}
          </p>
          <SponsorInterest project={project} roundAddress={roundAddress!} />
          <h3 className="text-sm font-semibold">
            {vi
              ? "Cập nhật sau khi nhận tiền"
              : "Updates after receiving funds"}
          </h3>
          {doc?.reports.length ? (
            <ol className="space-y-3">
              {doc.reports.map((report, i) => (
                <li key={i} className="border border-line p-3">
                  <time className="text-xs text-muted">
                    {new Date(report.publishedAt).toLocaleString(
                      vi ? "vi-VN" : "en-US",
                    )}
                  </time>
                  <p className="whitespace-pre-line break-words text-sm">
                    {report.text}
                  </p>
                  {/^https?:\/\//i.test(report.evidenceUrl) && (
                    <a
                      className="text-sm text-primary underline"
                      href={report.evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {vi
                        ? "Xem minh chứng do nhóm cung cấp"
                        : "View team-provided evidence"}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted">
              {project.claimed
                ? vi
                  ? "Đã claim; nhóm chưa đăng báo cáo sử dụng tiền."
                  : "Funds claimed; the team has not posted a spending update yet."
                : vi
                  ? "Nhóm đăng báo cáo sử dụng tiền sau khi giao dịch claim được xác nhận."
                  : "The team can report how funds are used after the claim transaction is confirmed."}
            </p>
          )}
          {owner && (
            <ProfileEditor
              key={`${address}:${chainId}:${roundAddress}:${project.id}:${doc?.revision ?? 0}`}
              project={project}
              round={roundAddress!}
              document={doc ?? null}
              labels={labels}
              onSaved={() => {
                void query.refetch();
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function ProfileEditor({
  project,
  round,
  document,
  labels,
  onSaved,
}: {
  project: Project & { claimed?: boolean };
  round: Address;
  document: ProfileDocument | null;
  labels: Record<keyof ProjectProfile, string>;
  onSaved: () => void;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const beginFlow = useTxFlow();
  const query = useQueryClient();
  const lock = useRef(false);
  const [profile, setProfile] = useState(document?.profile ?? EMPTY_PROFILE);
  const [report, setReport] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      lock.current ||
      busy ||
      !isConnected ||
      !address ||
      chainId !== TARGET_CHAIN_ID
    )
      return;
    setError("");
    let change;
    try {
      change = parseProfileChange({
        round,
        projectId: project.id,
        revision: document?.revision ?? 0,
        profile,
        report: report.trim() ? { text: report, evidenceUrl: evidence } : null,
      });
    } catch {
      setError(
        vi
          ? "Hãy nhập đủ các trường, ngân sách USDC lớn hơn 0 và URL minh chứng http(s) hợp lệ."
          : "Complete all fields, enter a positive USDC budget and a valid http(s) evidence URL.",
      );
      return;
    }
    const flow = beginFlow("publish-project-profile");
    lock.current = true;
    setBusy(true);
    try {
      const issuedAt = Date.now();
      const permit: ProfilePermit = {
        wallet: address.toLowerCase(),
        origin: window.location.origin,
        chainId: TARGET_CHAIN_ID,
        issuedAt,
        expiresAt: issuedAt + PROFILE_TTL,
      };
      const signature = await flow.wait(() =>
        signMessageAsync({
          account: address,
          message: profileMessage(change, permit),
        }),
      );
      const response = await flow.wait(() =>
        fetch("/api/project-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...change, permit, signature }),
        }),
      );
      const saved = await flow.wait(() => response.json());
      if (!response.ok) throw Error(saved.code ?? "PROFILE_UNAVAILABLE");
      if (saved.document?.revision !== change.revision + 1)
        throw Error("PROFILE_UNAVAILABLE");
      flow.toast.success(
        "project-profile",
        vi ? "Đã lưu hồ sơ công khai" : "Public proposal saved",
      );
      setReport("");
      setEvidence("");
      await query.invalidateQueries({
        queryKey: [
          "project-profile",
          TARGET_CHAIN_ID,
          round.toLowerCase(),
          project.id,
        ],
      });
      onSaved();
    } catch (e) {
      if (!flow.cancelled)
        setError(
          e instanceof Error && e.message === "PROFILE_CONFLICT"
            ? vi
              ? "Hồ sơ đã thay đổi ở phiên khác. Tải lại trang rồi cập nhật; bản nhập hiện tại chưa được lưu."
              : "This proposal changed in another session. Reload before saving; your edits have not been saved."
            : vi
              ? "Chưa lưu được hồ sơ. Nội dung nhập vẫn được giữ để bạn thử lại."
              : "The proposal was not saved. Your input is retained so you can retry.",
        );
    } finally {
      flow.finish();
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 border border-line bg-bg p-3">
      <h3 className="font-semibold">
        {vi
          ? "Chủ dự án: hoàn thiện hồ sơ"
          : "Project owner: complete your proposal"}
      </h3>
      <fieldset disabled={busy} className="space-y-3">
        {Object.entries(labels).map(([field, label]) => (
          <label key={field} className="block text-xs">
            {label}
            {field === "leadName" || field === "budgetUsdc" ? (
              <input
                required
                maxLength={field === "leadName" ? 100 : 24}
                inputMode={field === "budgetUsdc" ? "decimal" : undefined}
                className="mt-1 w-full border border-line bg-surface p-2"
                value={profile[field as keyof ProjectProfile] ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, [field]: e.target.value }))
                }
              />
            ) : (
              <textarea
                required={field !== "differentiator" && field !== "progress"}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full border border-line bg-surface p-2"
                value={profile[field as keyof ProjectProfile] ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, [field]: e.target.value }))
                }
              />
            )}
          </label>
        ))}
        {project.claimed && (document?.reports.length ?? 0) < 12 && (
          <>
            <label className="block text-xs">
              {vi
                ? "Báo cáo mới: đã làm gì, đã chi bao nhiêu, bước tiếp theo"
                : "New update: progress, spending and next steps"}
              <textarea
                maxLength={3000}
                rows={3}
                value={report}
                onChange={(e) => setReport(e.target.value)}
                className="mt-1 w-full border border-line bg-surface p-2"
              />
            </label>
            <label className="block text-xs">
              {vi
                ? "Link minh chứng (không bắt buộc)"
                : "Evidence link (optional)"}
              <input
                type="url"
                maxLength={500}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                className="mt-1 w-full border border-line bg-surface p-2"
              />
            </label>
          </>
        )}
        <p className="text-xs text-muted">
          {vi
            ? "Thông tin sẽ được công khai. Chỉ điền tên/liên hệ bạn đồng ý công bố; chữ ký không chuyển tiền. Báo cáo đã đăng được giữ trong lịch sử."
            : "This information will be public. Only publish a name you consent to share; signing does not transfer funds. Published updates remain in the history."}
        </p>
        <Button type="submit" disabled={busy} isLoading={busy}>
          {vi ? "Ký và lưu hồ sơ" : "Sign and save proposal"}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-xs text-primary">
          {error}
        </p>
      )}
    </form>
  );
}

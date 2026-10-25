"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RoundControls } from "@/components/admin/RoundControls";
import { RoundHistory } from "@/components/admin/RoundHistory";
import { useInitialPoolDeposit } from "@/hooks/useInitialPoolDeposit";
import { AOSInit } from "@/components/common/AOSInit";
import { useTxFlow } from "@/hooks/useTxFlow";
import { txToast } from "@/lib/txToast";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useAdminRounds } from "@/hooks/useAdminRounds";
import { useRound } from "@/hooks/useRound";
import { useProjects, type EnrichedProject } from "@/hooks/useProjects";
import { isPublicProject } from "@/lib/projectVisibility";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { ProjectReviewList } from "@/components/admin/ProjectReviewList";
import { ProjectModerationDialog } from "@/components/admin/ProjectModerationDialog";
import { projectModerationState, type ModerationAction } from "@/lib/projectModeration";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { useQueryClient } from "@tanstack/react-query";
import { formatUsdcFixed, formatCount } from "@/lib/format";
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { MintTestUsdcForm } from "@/components/admin/MintTestUsdcForm";
import { PlatformDashboard } from "@/components/admin/PlatformDashboard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusAlert } from "@/components/ui/StatusAlert";
import { AdminSkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";
import { Award, ShieldCheck, Layers, Info, Building2, ShieldOff, Send, Plus, ArrowLeft } from "lucide-react";
import { ApplyOrganizerModal } from "@/components/organizer/ApplyOrganizerModal";
import { useMyOrganizerApplication } from "@/hooks/useOrganizerApplications";
import type { Address } from "viem";

export function AdminView() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const router = useRouter();
  const { address, chainId, isConnected, status: accountStatus } = useAccount();
  const initialDeposit = useInitialPoolDeposit(isConnected ? address : undefined);
  const hasUnusedDeposit = initialDeposit.supported && (initialDeposit.credit ?? 0n) > 0n;
  const myApp = useMyOrganizerApplication(isConnected ? address : undefined);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const closeApplyModal = useCallback(() => setApplyModalOpen(false), []);
  const [roundBusy, setRoundBusy] = useState(false);

  const managed = useAdminRounds(isConnected && chainId === TARGET_CHAIN_ID ? address : undefined);
  const selectedRound = managed.roundAddress;
  const searchParams = useSearchParams();
  const notificationRound = searchParams.get("round");
  const selectManagedRound = managed.selectRound;
  useEffect(() => {
    // Link thông báo chỉ chọn trong các Round thuộc ví, không mở quyền cho ví khác.
    if (notificationRound) selectManagedRound(notificationRound);
  }, [notificationRound, selectManagedRound]);
  const {
    role,
    roles,
    isPlatformOwner,
    isOrganizer,
    isRoundAdmin,
    canCreateRound,
    isAdmin,
    isAuthorizationLoading,
    isAuthorizationError,
    isLegacyFactory,
    isFactoryAuthorizationError,
    refetchAuthorization,
  } = useRole(selectedRound);

  // URL là nguồn duy nhất để menu ví, nút tab và Back/Forward luôn đồng bộ.
  const requestedTab = searchParams.get("tab");
  const activeTab = isPlatformOwner
    ? (requestedTab === "organizer" ? "organizer" : "platform")
    : "organizer";

  const switchTab = (tab: "organizer" | "platform") => {
    if (tab === "platform" && !isPlatformOwner) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  const isCreateAction = searchParams.get("action") === "create";
  const setCreateAction = (create: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (create) {
      params.set("action", "create");
    } else {
      params.delete("action");
    }
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  const round = useRound(selectedRound);
  const {
    roundAddress: loadedRoundAddress,
    admin: roundAdmin,
    name: roundName,
    endTime,
    isCancelled,
    finalized,
    refetch: refetchRound,
    isLoading: isRoundLoading,
  } = round;
  // Dashboard Organizer chỉ chọn trong các vòng thực sự thuộc ví hiện tại.
  const roundAddress = selectedRound ? loadedRoundAddress : undefined;

  const {
    projects,
    supportsRejection,
    refetch: refetchProjects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
  } = useProjects(roundAddress, { enabled: Boolean(roundAddress) });

  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const queries = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const hasAnyAdminAccess = isPlatformOwner || isOrganizer || isRoundAdmin || isAdmin || role === "admin" || hasUnusedDeposit;
  // The already-deployed funding-only Factory still permits its owner to use this flow.
  const canUseCreationForm = canCreateRound || (initialDeposit.supported && initialDeposit.isOwner) || hasUnusedDeposit;

  useEffect(() => {
    if (isConnected && !isAuthorizationLoading && hasAnyAdminAccess && requestedTab === "platform" && !isPlatformOwner) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "organizer");
      router.replace(`/admin?${params.toString()}`, { scroll: false });
    }
  }, [isConnected, isAuthorizationLoading, hasAnyAdminAccess, requestedTab, isPlatformOwner, searchParams, router]);

  useEffect(() => {
    if (accountStatus === "reconnecting" || accountStatus === "connecting" || isAuthorizationLoading) return;
    if (!isConnected) {
      txToast.error("admin-access", t.wallet.accessDenied);
      router.replace("/");
    }
  }, [accountStatus, isAuthorizationLoading, isConnected, router, t.wallet.accessDenied]);

  const [busyProjectId, setBusyProjectId] = useState<bigint | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ project: EnrichedProject; action: ModerationAction } | null>(null);
  const [reviewError, setReviewError] = useState<string>();
  const [reviewPhase, setReviewPhase] = useState<"idle" | "signing" | "confirming">("idle");
  const reviewBusy = useRef(false);
  const now = useCurrentTimestamp();
  const moderationRound = { admin: roundAdmin, endTime, finalized, isCancelled, supportsRejection };
  const viewer = isConnected && chainId === TARGET_CHAIN_ID ? address : undefined;

  // Check if current user is admin of selected round
  const isSelectedRoundAdmin = useMemo(() => {
    if (!viewer || !roundAdmin) return false;
    return viewer.toLowerCase() === roundAdmin.toLowerCase();
  }, [viewer, roundAdmin]);

  useEffect(() => {
    setReviewTarget(null);
    setReviewError(undefined);
  }, [roundAddress, viewer]);

  const currentTarget = projects.find(project => project.id === reviewTarget?.project.id && project.roundId === reviewTarget?.project.roundId);
  const targetState = currentTarget ? projectModerationState(currentTarget, moderationRound, viewer, now) : undefined;
  const blockedReason = !reviewTarget ? undefined
    : !currentTarget || reviewTarget.project.roundId.toLowerCase() !== roundAddress?.toLowerCase() ? t.moderation.changed
    : !targetState?.showActions ? t.moderation[targetState!.reason!]
    : reviewTarget.action === "reject" && !targetState.canReject ? t.moderation.legacy : undefined;

  function openReview(project: EnrichedProject, action: ModerationAction) {
    const state = projectModerationState(project, moderationRound, viewer, now);
    if (reviewBusy.current || !state.showActions || (action === "reject" && !state.canReject)) return;
    setReviewError(undefined);
    setReviewPhase("idle");
    setReviewTarget({ project, action });
  }

  async function confirmReview() {
    if (reviewBusy.current || !reviewTarget || !currentTarget || !roundAddress || !publicClient) return;
    const state = projectModerationState(currentTarget, moderationRound, viewer, Math.floor(Date.now() / 1000));
    if (reviewTarget.project.roundId.toLowerCase() !== roundAddress.toLowerCase()) {
      setReviewError(t.moderation.changed);
      return;
    }
    if (!state.showActions || (reviewTarget.action === "reject" && !state.canReject)) {
      setReviewError(t.moderation[state.reason || "legacy"]);
      return;
    }
    reviewBusy.current = true;
    setBusyProjectId(currentTarget.contractId);
    setReviewError(undefined);
    setReviewPhase("signing");
    const { action } = reviewTarget;
    const flow = beginFlow("project-review");
    const toastId = `${action}-project-${currentTarget.id}`;
    const title = action === "approve" ? t.toasts.approvingProjectTitle : t.rejection.pending;
    try {
      flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: action === "approve" ? "approveProject" : "rejectProject",
        args: [currentTarget.contractId],
        chainId: TARGET_CHAIN_ID,
      }));
      setReviewPhase("confirming");
      flow.toast.pending(toastId, title, t.transactions.confirming, hash);
      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") throw new Error(t.moderation.reverted);
      flow.toast.success(toastId, action === "approve" ? t.toasts.projectApprovedTitle : t.rejection.success, currentTarget.name, hash);
      setReviewTarget(null);
      await refetchProjects();
      refetchRound();
      await queries.invalidateQueries();
    } catch (error) {
      if (!flow.cancelled) {
        setReviewError(isUserRejected(error) ? t.transactions.rejectedDescription : getContractErrorMessage(error, locale));
        flow.error(toastId, error, action === "approve" ? t.toasts.approvalFailed : t.rejection.failed, locale);
      }
    } finally {
      flow.finish();
      reviewBusy.current = false;
      setBusyProjectId(null);
      setReviewPhase("idle");
    }
  }

  if (accountStatus === "reconnecting" || accountStatus === "connecting" || isAuthorizationLoading || (activeTab === "organizer" && managed.isLoading) || (activeTab === "organizer" && Boolean(selectedRound) && isRoundLoading)) {
    return (
      <Container className="py-8 sm:py-10">
        <AdminSkeleton />
      </Container>
    );
  }

  if (!isConnected) {
    return <Container className="py-8 sm:py-10"><AdminSkeleton /></Container>;
  }

  if (isAuthorizationError && !hasAnyAdminAccess) {
    return <Container className="py-8 space-y-4">
      <StatusAlert tone="error" title={locale === "vi" ? "Chưa xác định được quyền quản trị" : "Unable to verify dashboard access"}>
        {isLegacyFactory
          ? (locale === "vi" ? "Factory đang cấu hình chưa hỗ trợ Multi-Organizer. Cần cấu hình địa chỉ Factory mới đã deploy và xác minh." : "The configured Factory does not support Multi-Organizer. Configure a verified deployment.")
          : (locale === "vi" ? "Không đọc được quyền từ blockchain. Vui lòng thử lại." : "Could not read authorization from the blockchain. Please retry.")}
      </StatusAlert>
      <Button onClick={refetchAuthorization}>{locale === "vi" ? "Thử lại" : "Retry"}</Button>
    </Container>;
  }

  // Chỉ kết luận không có quyền sau khi các truy vấn quản trị đã hoàn tất.
  if (!hasAnyAdminAccess) {
    return (
      <Container className="py-8 sm:py-10 space-y-6">
        {myApp.isRevoked ? (
          <div className="p-5 border border-destructive/30 bg-destructive/5 rounded-xs space-y-4">
            <div className="flex items-center gap-2 text-destructive font-bold text-base">
              <ShieldOff className="h-5 w-5" />
              <span>{locale === "vi" ? "Quyền Nhà tổ chức của bạn đã bị thu hồi" : "Organizer Permission Revoked"}</span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {locale === "vi"
                ? "Platform Owner đã thu hồi quyền tạo và quản lý vòng gọi vốn của ví này. Bạn có thể xem chi tiết lí do bên dưới hoặc gửi lại yêu cầu cấp quyền."
                : "The Platform Owner has revoked this wallet's organizer access. You can view details below or re-apply."}
            </p>
            {myApp.application?.revocationReason && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xs text-xs font-mono">
                <span className="font-semibold text-destructive">{locale === "vi" ? "Lí do thu hồi: " : "Revocation reason: "}</span>
                <span className="text-foreground">{myApp.application.revocationReason}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="primary" onClick={() => setApplyModalOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                {locale === "vi" ? "Xem chi tiết & Gửi yêu cầu lại" : "View Details & Re-apply"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                {t.admin.backToHome ?? "Back to Home"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <StatusAlert tone="warning" title={t.admin.unauthorizedAdminTitle ?? "Access Restricted"}>
              {t.admin.unauthorizedAdminDesc ?? "You need Platform Owner, Organizer, or Round Admin authorization to view this area."}
            </StatusAlert>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => setApplyModalOpen(true)}>
                <Building2 className="h-4 w-4 mr-2" />
                {t.applyOrganizer.btnMenu}
              </Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                {t.admin.backToHome ?? "Back to Home"}
              </Button>
            </div>
          </>
        )}
        {address && (
          <ApplyOrganizerModal
            isOpen={applyModalOpen}
            onClose={closeApplyModal}
            walletAddress={address}
            isOrganizer={isOrganizer}
            isPlatformOwner={isPlatformOwner}
          />
        )}
      </Container>
    );
  }

  const approvedProjects = projects.filter(isPublicProject);

  return (
    <Container className="py-8 sm:py-10 space-y-8">
      <AOSInit />
      {/* Administration header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6"
        data-aos="fade-down"
        data-aos-duration="600"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {activeTab === "platform"
              ? (t.admin.platformTitle ?? "Platform Dashboard")
              : (t.admin.organizerTitle ?? t.admin.title)}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            {activeTab === "platform"
              ? (t.admin.platformSubtitle ?? "Authorize organizers to deploy quadratic funding rounds on Avalanche Fuji.")
              : (t.admin.organizerSubtitle ?? t.admin.adminSubtitle)}
          </p>
        </div>
      </div>

      {/* Two Dashboards Tab Navigation */}
      <div className="flex border-b border-line gap-2" role="tablist" aria-label="Dashboard views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "organizer"}
          onClick={() => switchTab("organizer")}
          className={`mono-label flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "organizer"
              ? "border-primary text-foreground bg-surface/50"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface/30"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>{t.admin.tabOrganizer ?? "Organizer Dashboard"}</span>
          {isRoundAdmin && (
            <Badge variant="warning" className="text-[10px] px-1 py-0">
              {t.admin.badgeRoundAdmin ?? "Round Admin"}
            </Badge>
          )}
        </button>

        {isPlatformOwner && <button
          type="button"
          role="tab"
          aria-selected={activeTab === "platform"}
          onClick={() => switchTab("platform")}
          className={`mono-label flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "platform"
              ? "border-primary text-foreground bg-surface/50"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface/30"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{t.admin.tabPlatform ?? "Platform Dashboard"}</span>
        </button>}
      </div>

      {/* TAB 1: Platform Dashboard (Authorize / Revoke Organizers) */}
      {isPlatformOwner && activeTab === "platform" && (
        <PlatformDashboard
          factoryOwner={round.factoryOwner}
          isPlatformOwner={isPlatformOwner}
          authorizationError={isFactoryAuthorizationError}
          allRounds={round.allRounds}
        />
      )}

      {/* TAB 2: Organizer Dashboard (Manage Rounds, Funds, Projects, and Allocations) */}
      {activeTab === "organizer" && (
        <div className="space-y-8" data-aos="fade-up" data-aos-duration="600">
          {/* Back button when in create round view */}
          {isCreateAction && (
            <div className="flex items-center justify-between border-b border-line pb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCreateAction(false)}
                className="text-xs font-semibold gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{locale === "vi" ? "Quay lại quản lý vòng gọi vốn" : "Back to manage rounds"}</span>
              </Button>
            </div>
          )}

          {isCreateAction ? (
            <div className="space-y-6" data-aos="fade-up" data-aos-duration="600">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {t.admin.createRoundTitle}
                  </h2>
                  <p className="text-xs text-muted">
                    {t.admin.organizerSubtitle ?? (locale === "vi" ? "Thiết lập thông tin và triển khai vòng Quadratic Funding mới trên Avalanche Fuji." : "Set parameters and deploy a new Quadratic Funding round on Avalanche Fuji.")}
                  </p>
                </div>
              </div>

              {canUseCreationForm ? (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] [&>*]:min-w-0">
                  <CreateRoundForm key={`${address}:${chainId}`} />
                  <MintTestUsdcForm />
                </div>
              ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] [&>*]:min-w-0">
                  <div className="border border-line bg-surface p-5 rounded-sm space-y-2">
                    <h3 className="text-sm font-bold text-foreground">
                      {t.admin.createRoundTitle}
                    </h3>
                    <p className="text-xs text-muted">
                      {t.admin.createRoundDisabledNote ?? "Only authorized Organizers and the Platform Owner can deploy new rounds."}
                    </p>
                  </div>
                  <MintTestUsdcForm />
                </div>
              )}
            </div>
          ) : (
            <>
          {/* Read-only notification if current user is not admin of selected round */}
          {roundAddress && !isSelectedRoundAdmin && (
            <div className="border border-line bg-surface-2/40 p-4 rounded-sm flex items-start gap-3 text-xs">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {t.admin.badgeReadOnly ?? "Read-only mode"}
                </p>
                <p className="text-muted leading-relaxed">
                  {t.admin.readOnlyRoundBanner ?? "You are viewing this round in read-only mode. Only its admin can manage funds, moderate projects, or finalize."}
                </p>
              </div>
            </div>
          )}

          {managed.isError && <StatusAlert tone="error" title={locale === "vi" ? "Không tải được danh sách vòng của bạn" : "Could not load your rounds"}>
            <Button onClick={managed.refetch}>{locale === "vi" ? "Thử lại" : "Retry"}</Button>
          </StatusAlert>}
          {!managed.isError && !roundAddress && <StatusAlert title={locale === "vi" ? "Bạn chưa có vòng gọi vốn" : "You have no rounds yet"} />}
          {isFactoryAuthorizationError && !(initialDeposit.supported && initialDeposit.isOwner) && <StatusAlert tone="warning" title={locale === "vi" ? "Chưa thể tạo vòng mới" : "Round creation unavailable"}>
            {isLegacyFactory ? (locale === "vi" ? "Factory đang cấu hình chưa hỗ trợ Multi-Organizer. Cần cập nhật địa chỉ sau khi deploy và xác minh Factory mới." : "Configure a verified Multi-Organizer Factory deployment.") : (locale === "vi" ? "Không đọc được quyền tạo vòng. Vui lòng thử lại." : "Could not verify round creation permissions.")}
          </StatusAlert>}
          {roundAddress && (
            <section aria-label={t.roundControls.historyTitle} className="border border-line bg-surface">
              <RoundHistory
                addresses={managed.rounds.map(item => item.address as Address)}
                selected={roundAddress}
                selectedName={roundName}
                disabled={roundBusy || busyProjectId !== null}
                onSelect={managed.selectRound}
              />
              {isRoundLoading ? (
                <p role="status" className="p-8 text-center text-sm text-muted">{t.common.loading}</p>
              ) : (
                <RoundControls
                  key={`controls:${roundAddress || "no-round"}`}
                  round={{ ...round, allRounds: managed.rounds.map(item => item.address) }}
                  projects={projects}
                  projectsLoading={isProjectsLoading}
                  projectsError={isProjectsError}
                  onBusyChange={setRoundBusy}
                />
              )}
            </section>
          )}

          {/* Finalized Round Distribution Results Table */}
          {!isRoundLoading && roundAddress && finalized && !isCancelled && (
            <section
              className="border border-money/40 bg-money/10 p-6 space-y-4 rounded-sm"
              data-aos="fade-up"
              data-aos-duration="600"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-money" />
                  <h2 className="text-lg font-bold text-foreground">
                    {t.admin.resultsTableTitle}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="accent">{t.admin.roundFinalizedBadge}</Badge>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="role-label">{t.admin.colProject}</TableHead>
                    <TableHead className="role-label">{t.admin.colSupporters}</TableHead>
                    <TableHead className="role-label">{t.admin.colDirectDonations}</TableHead>
                    <TableHead className="role-label">{t.admin.colMatchingPayout}</TableHead>
                    <TableHead className="text-right role-label">{t.admin.colTotalDisbursed}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedProjects.map((p) => {
                    const matching = p.finalMatching;
                    const total = matching === undefined ? undefined : p.totalDonated + matching;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold text-foreground">
                          {p.name}
                        </TableCell>
                        <TableCell className="font-mono text-foreground tabular-nums">
                          {formatCount(p.supporterCount)}
                        </TableCell>
                        <TableCell className="font-mono text-foreground tabular-nums">
                          {formatUsdcFixed(p.totalDonated)}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-money tabular-nums">
                          {matching === undefined ? t.competition.unavailable : formatUsdcFixed(matching)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-foreground tabular-nums">
                          {total === undefined ? t.competition.unavailable : formatUsdcFixed(total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>
          )}

          {reviewTarget && (
            <ProjectModerationDialog
              key={`${reviewTarget.project.roundId}:${reviewTarget.project.id}:${reviewTarget.action}`}
              project={reviewTarget.project}
              action={reviewTarget.action}
              roundName={roundName}
              roundAddress={roundAddress}
              pending={busyProjectId !== null}
              phase={reviewPhase}
              blockedReason={blockedReason}
              error={reviewError}
              onClose={() => {
                if (!reviewBusy.current) {
                  setReviewTarget(null);
                  setReviewError(undefined);
                }
              }}
              onConfirm={() => void confirmReview()}
            />
          )}

          {/* Project Proposals Approval Queue (Actionable for Round Admin) */}
          {!isRoundLoading && roundAddress && (
            <ProjectReviewList
              key={`review:${roundAddress || "no-round"}`}
              projects={projects}
              round={moderationRound}
              viewer={viewer}
              now={now}
              pending={busyProjectId !== null}
              isLoading={isProjectsLoading}
              isError={isProjectsError}
              onRetry={() => void refetchProjects()}
              onAction={(project, action) => {
                const current = projects.find(item => item.id === project.id);
                if (current) openReview(current, action);
              }}
            />
          )}

          {/* Round creation & minting section */}
          {canUseCreationForm ? (
            <div
              className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] [&>*]:min-w-0"
              data-aos="fade-up"
              data-aos-duration="600"
            >
              <CreateRoundForm key={`${address}:${chainId}`} />
              <MintTestUsdcForm />
            </div>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] [&>*]:min-w-0">
              <div className="border border-line bg-surface p-5 rounded-sm space-y-2">
                <h3 className="text-sm font-bold text-foreground">
                  {t.admin.createRoundTitle}
                </h3>
                <p className="text-xs text-muted">
                  {t.admin.createRoundDisabledNote ?? "Only authorized Organizers and the Platform Owner can deploy new rounds."}
                </p>
              </div>
              <MintTestUsdcForm />
            </div>
          )}
            </>
          )}
        </div>
      )}
    </Container>
  );
}

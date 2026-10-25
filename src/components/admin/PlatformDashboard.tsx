"use client";

import { Pagination } from "@/components/common/Pagination";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { isHash, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { loadOrganizerRegistry, type OrganizerEntry } from "@/lib/organizerRegistry";
import { useTxFlow } from "@/hooks/useTxFlow";
import { useLocale } from "@/lib/context/locale";
import { isUserRejected } from "@/lib/errors";
import { shortAddress } from "@/lib/format";
import { ExplorerLink } from "@/components/tx/ExplorerLink";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

import { Dialog } from "@/components/ui/Dialog";
import { useOrganizerApplicationsAdmin, type OrganizerApplication } from "@/hooks/useOrganizerApplications";
import { txToast } from "@/lib/txToast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import {
  UserCheck,
  UserX,
  Copy,
  Check,
  RefreshCw,
  Award,
  Mail,
  Inbox,
  AlertTriangle,
} from "lucide-react";

interface PlatformDashboardProps {
  factoryOwner?: Address;
  isPlatformOwner: boolean;
  allRounds?: Address[];
  authorizationError?: boolean;
}

const EMPTY_ROUNDS: Address[] = [];
const APPLICATIONS_PAGE_SIZE = 4;

export function PlatformDashboard({
  factoryOwner,
  isPlatformOwner,
  allRounds = EMPTY_ROUNDS,
  authorizationError = false,
}: PlatformDashboardProps) {
  const { t, locale } = useLocale();
  const c = t.admin;
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const queries = useQueryClient();
  const beginFlow = useTxFlow();

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Organizers Registry
  const [, setOrganizers] = useState<OrganizerEntry[]>([]);
  const [, setIsLoadingRegistry] = useState(false);
  const [, setRegistryError] = useState(false);
  const registryRequest = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      if (isMounted.current) setCopiedKey(null);
    }, 1500);
  };

  // Lịch sử cấp/thu hồi lấy từ blockchain, không phụ thuộc localStorage.
  const refreshRegistry = useCallback(async () => {
    if (!isPlatformOwner || !publicClient || !factoryAddress) return;
    const request = ++registryRequest.current;
    setIsLoadingRegistry(true);
    setRegistryError(false);
    try {
      const entries = await loadOrganizerRegistry(publicClient, factoryAddress, allRounds, factoryOwner);
      if (isMounted.current && request === registryRequest.current) {
        setOrganizers(entries);
        setRegistryError(entries.some(entry => entry.authorized === undefined));
      }
    } catch {
      if (isMounted.current && request === registryRequest.current) setRegistryError(true);
    } finally {
      if (isMounted.current && request === registryRequest.current) setIsLoadingRegistry(false);
    }
  }, [publicClient, allRounds, factoryOwner, isPlatformOwner]);

  useEffect(() => {
    void refreshRegistry();
  }, [refreshRegistry]);

  // Organizer Applications State
  const [appsFilter, setAppsFilter] = useState<string>("all");
  const [appsPage, setAppsPage] = useState(1);
  const [selectedAppForReason, setSelectedAppForReason] = useState<OrganizerApplication | null>(null);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);

  // Revocation Modal State
  const [revokeTarget, setRevokeTarget] = useState<OrganizerApplication | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const {
    applications,
    pendingCount,
    isLoading: isAppsLoading,
    approveApplication,
    rejectApplication,
    revokeApplication,
    refetch: refetchApps,
  } = useOrganizerApplicationsAdmin(appsFilter, isPlatformOwner);

  const sortedApplications = [...applications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const totalPages = Math.max(1, Math.ceil(sortedApplications.length / APPLICATIONS_PAGE_SIZE));
  const currentPage = Math.min(appsPage, totalPages);
  const pageStart = (currentPage - 1) * APPLICATIONS_PAGE_SIZE;
  const visibleApplications = sortedApplications.slice(pageStart, pageStart + APPLICATIONS_PAGE_SIZE);

  const handleApproveApplication = async (app: OrganizerApplication) => {
    if (!isConnected || chainId !== TARGET_CHAIN_ID || !publicClient) {
      txToast.error("app-approve", "Please connect your wallet to Avalanche Fuji.");
      return;
    }
    if (!isPlatformOwner || authorizationError) {
      txToast.error("app-approve", c.platformOwnerOnlyAlert ?? "Only the Platform Owner can manage organizers.");
      return;
    }

    setBusyAppId(app.id);
    const flow = beginFlow("approve-application");
    const toastId = `approve-${app.id.slice(0, 8)}`;
    const title = c.grantingTitle ?? "Authorizing on Fuji...";

    try {
      flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
      const hash = await flow.wait(() =>
        writeContractAsync({
          address: factoryAddress,
          abi: roundFactoryAbi,
          functionName: "setOrganizer",
          args: [app.walletAddress as Address, true],
          chainId: TARGET_CHAIN_ID,
        })
      );

      if (typeof hash !== "string" || !isHash(hash)) throw new Error("Wallet returned an invalid transaction hash");
      flow.toast.pending(toastId, title, t.transactions.confirming, hash);
      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Transaction reverted on-chain");
      }

      await flow.wait(() => approveApplication(app.id, hash, address));
      flow.toast.success(toastId, c.grantSuccessTitle ?? "Organizer authorized on-chain & application approved!", undefined, hash);
      await flow.wait(() => Promise.all([refreshRegistry(), refetchApps(), queries.invalidateQueries()]));
    } catch (error) {
      if (!flow.cancelled) flow.error(toastId, error,
        isUserRejected(error) ? t.wallet.connectionRejected : (c.grantingTitle ?? "Grant Failed"), locale);
    } finally {
      flow.finish();
      if (isMounted.current) setBusyAppId(null);
    }
  };

  const handleRejectApplication = async (app: OrganizerApplication) => {
    if (!confirm(c.confirmRejectMsg ?? "Are you sure you want to reject this organizer application?")) {
      return;
    }
    setBusyAppId(app.id);
    try {
      await rejectApplication(app.id, address);
      txToast.info("app-reject", c.rejectSuccessTitle ?? "Application rejected.");
      await refetchApps();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to reject application";
      txToast.error("app-reject", msg);
    } finally {
      if (isMounted.current) setBusyAppId(null);
    }
  };

  // Open revocation modal instead of directly revoking
  const openRevokeModal = (app: OrganizerApplication) => {
    setRevokeTarget(app);
    setRevokeReason("");
    setRevokeError(null);
  };

  const closeRevokeModal = () => {
    setRevokeTarget(null);
    setRevokeReason("");
    setRevokeError(null);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    const reason = revokeReason.trim();
    if (reason.length < 3) {
      setRevokeError(locale === "vi" ? "Vui lòng nhập lí do thu hồi (tối thiểu 3 ký tự)." : "Please enter a revocation reason (minimum 3 characters).");
      return;
    }

    if (!isConnected || chainId !== TARGET_CHAIN_ID || !publicClient) {
      txToast.error("app-revoke", locale === "vi" ? "Vui lòng kết nối ví Avalanche Fuji." : "Please connect your wallet to Avalanche Fuji.");
      return;
    }
    if (!isPlatformOwner || authorizationError) {
      txToast.error("app-revoke", c.platformOwnerOnlyAlert ?? "Only the Platform Owner can manage organizers.");
      return;
    }

    const app = revokeTarget;
    setBusyAppId(app.id);
    closeRevokeModal();
    const flow = beginFlow("revoke-application");
    const toastId = `revoke-${app.id.slice(0, 8)}`;
    const title = locale === "vi" ? "Đang thu hồi quyền trên Fuji..." : "Revoking on Fuji...";

    try {
      flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
      const hash = await flow.wait(() =>
        writeContractAsync({
          address: factoryAddress,
          abi: roundFactoryAbi,
          functionName: "setOrganizer",
          args: [app.walletAddress as Address, false],
          chainId: TARGET_CHAIN_ID,
        })
      );

      if (typeof hash !== "string" || !isHash(hash)) throw new Error("Wallet returned an invalid transaction hash");
      flow.toast.pending(toastId, title, t.transactions.confirming, hash);
      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Transaction reverted on-chain");
      }

      await flow.wait(() => revokeApplication(app.id, hash, reason, address));
      flow.toast.success(
        toastId,
        locale === "vi" ? "Đã thu hồi quyền Organizer on-chain!" : "Organizer permission revoked on-chain!",
        undefined,
        hash
      );
      await flow.wait(() => Promise.all([refetchApps(), queries.invalidateQueries()]));
    } catch (error) {
      if (!flow.cancelled) flow.error(toastId, error,
        isUserRejected(error) ? t.wallet.connectionRejected : (locale === "vi" ? "Thu hồi thất bại" : "Revoke Failed"), locale);
    } finally {
      flow.finish();
      if (isMounted.current) setBusyAppId(null);
    }
  };



  if (!isPlatformOwner) return null;

  return (
    <div className="space-y-8" data-aos="fade-up" data-aos-duration="600">
      {/* Platform Owner Status - only shown when not owner (guard above already returns null) */}

      {/* Contract & Owner Info Card */}
      <section className="border border-line bg-surface p-5 space-y-4 rounded-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {c.platformTitle ?? "Platform Dashboard"}
            </h2>
          </div>
          {isPlatformOwner ? (
            <Badge variant="primary">{c.youAreOwner ?? "You are Platform Owner"}</Badge>
          ) : (
            <Badge variant="warning">{c.badgeReadOnly ?? "Read-only"}</Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="border border-line-strong/40 bg-surface-2/40 p-3 rounded-xs space-y-1">
            <span className="role-label text-muted block">
              {c.factoryAddressLabel ?? "RoundFactory Address"}
            </span>
            <div className="flex items-center justify-between gap-2 font-mono">
              <span className="truncate">{factoryAddress}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(factoryAddress, "factory")}
                  className="p-1 hover:text-foreground text-muted transition-colors cursor-pointer"
                  aria-label="Copy Factory Address"
                >
                  {copiedKey === "factory" ? (
                    <Check className="h-3.5 w-3.5 text-money" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <ExplorerLink address={factoryAddress} iconOnly />
              </div>
            </div>
          </div>

          <div className="border border-line-strong/40 bg-surface-2/40 p-3 rounded-xs space-y-1">
            <span className="role-label text-muted block">
              {c.platformOwnerLabel ?? "Platform Owner Address"}
            </span>
            <div className="flex items-center justify-between gap-2 font-mono">
              <span className="truncate">{factoryOwner ?? "—"}</span>
              {factoryOwner && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(factoryOwner, "owner")}
                    className="p-1 hover:text-foreground text-muted transition-colors cursor-pointer"
                    aria-label="Copy Owner Address"
                  >
                    {copiedKey === "owner" ? (
                      <Check className="h-3.5 w-3.5 text-money" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <ExplorerLink address={factoryOwner} iconOnly />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>



      {/* Section: Organizer Applications Queue */}
      <section className="border border-line bg-surface p-5 space-y-4 rounded-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  {c.applicationsTitle ?? "Organizer Applications"}
                </h3>
                {pendingCount > 0 && (
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0.5">
                    {c.pendingBadgeCount ? c.pendingBadgeCount.replace("{count}", String(pendingCount)) : `${pendingCount} pending`}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {c.applicationsSubtitle ?? "Review and authorize student clubs and organizations to deploy quadratic funding rounds."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center border border-line rounded-xs p-0.5 text-xs">
              {(["all", "pending", "approved", "rejected", "revoked"] as const).map(filterKey => {
                const label = filterKey === "all" ? c.filterAll : filterKey === "pending" ? c.filterPending : filterKey === "approved" ? c.filterApproved : filterKey === "revoked" ? (locale === "vi" ? "Đã thu hồi" : "Revoked") : c.filterRejected;
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => { setAppsFilter(filterKey); setAppsPage(1); }}
                    className={`px-2.5 py-1 rounded-xs font-mono transition-colors cursor-pointer ${
                      appsFilter === filterKey
                        ? "bg-primary text-black font-semibold"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void refetchApps()}
              disabled={isAppsLoading}
              className="text-xs text-muted hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${isAppsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {applications.length === 0 ? (
          <p className="text-xs text-muted py-8 text-center">
            {isAppsLoading ? (locale === "vi" ? "Đang tải đơn đăng ký..." : "Loading applications...") : (c.noApplications ?? "No applications found.")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="role-label">{c.appColOrg ?? "Organization"}</TableHead>
                <TableHead className="role-label">{c.appColWallet ?? "Wallet"}</TableHead>
                <TableHead className="role-label">{c.appColReason ?? "Reason"}</TableHead>
                <TableHead className="role-label">{c.appColStatus ?? "Status"}</TableHead>
                <TableHead className="role-label">{c.appColDate ?? "Date"}</TableHead>
                <TableHead className="role-label text-right">{c.appColActions ?? "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleApplications.map((app) => {
                const isPending = app.status === "pending";
                const isApproved = app.status === "approved";
                const isRevoked = app.status === "revoked" || (app.status === "rejected" && Boolean(app.txHash));
                const isBusy = busyAppId === app.id;

                return (
                  <TableRow key={app.id}>
                    <TableCell className="text-xs">
                      <div className="font-bold text-foreground">{app.organizationName}</div>
                      <a
                        href={`mailto:${app.contactEmail}`}
                        className="text-[11px] text-muted hover:text-primary transition-colors flex items-center gap-1 mt-0.5"
                      >
                        <Mail className="h-3 w-3" />
                        {app.contactEmail}
                      </a>
                      <Badge variant={app.emailVerifiedAt ? "accent" : "default"} className="mt-1 text-[10px]">
                        {app.emailVerifiedAt ? (locale === "vi" ? "Email đã xác thực" : "Email verified") : (locale === "vi" ? "Email chưa xác thực" : "Email not verified")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{shortAddress(app.walletAddress, 6)}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(app.walletAddress, `app-wallet-${app.id}`)}
                          className="p-1 hover:text-foreground text-muted transition-colors cursor-pointer"
                        >
                          {copiedKey === `app-wallet-${app.id}` ? (
                            <Check className="h-3 w-3 text-money" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                        <ExplorerLink address={app.walletAddress} iconOnly />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs">
                      <p className="line-clamp-2 text-muted leading-relaxed">{app.reason}</p>
                      {app.reason.length > 80 && (
                        <button
                          type="button"
                          onClick={() => setSelectedAppForReason(app)}
                          className="text-[11px] text-primary hover:underline mt-1 cursor-pointer"
                        >
                          {locale === "vi" ? "Xem toàn bộ" : "View full"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPending ? (
                        <Badge variant="warning" className="text-[10px]">
                          {t.applyOrganizer.statusPendingBadge ?? "Pending"}
                        </Badge>
                      ) : isApproved ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="primary" className="text-[10px]">
                            {t.applyOrganizer.statusApprovedBadge ?? "Approved"}
                          </Badge>
                          {app.txHash && (
                            <ExplorerLink txHash={app.txHash} iconOnly />
                          )}
                        </div>
                      ) : isRevoked ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="warning" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
                            {locale === "vi" ? "Đã thu hồi quyền" : "Revoked"}
                          </Badge>
                          {app.txHash && (
                            <ExplorerLink txHash={app.txHash} iconOnly />
                          )}
                        </div>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          {t.applyOrganizer.statusRejectedBadge ?? "Rejected"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted whitespace-nowrap">
                      {new Date(app.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
                    </TableCell>
                    <TableCell className="text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={isBusy || !isPlatformOwner}
                            onClick={() => void handleApproveApplication(app)}
                            className="text-xs py-1 px-2.5 h-auto font-semibold"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            {isBusy ? (locale === "vi" ? "Đang xử lý..." : "Processing...") : c.btnGrantAndApprove}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy || !isPlatformOwner}
                            onClick={() => void handleRejectApplication(app)}
                            className="text-xs py-1 px-2.5 h-auto text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            {c.btnReject}
                          </Button>
                        </div>
                      ) : isApproved ? (
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy || !isPlatformOwner}
                            onClick={() => openRevokeModal(app)}
                            className="text-xs py-1 px-2.5 h-auto text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold"
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            {isBusy ? (locale === "vi" ? "Đang thu hồi..." : "Revoking...") : (locale === "vi" ? "Thu hồi quyền" : "Revoke")}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted font-mono">
                          {isRevoked ? (locale === "vi" ? "Đã thu hồi quyền" : "Revoked") : "Declined"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {totalPages > 1 && (
          <Pagination page={currentPage} pageSize={APPLICATIONS_PAGE_SIZE} total={applications.length} onPageChange={setAppsPage} label={locale === "vi" ? "Phân trang đơn Organizer" : "Pagination"} />
        )}
      </section>

      {/* Detail Dialog for viewing application reason */}
      {selectedAppForReason && (
        <Dialog
          isOpen={Boolean(selectedAppForReason)}
          onClose={() => setSelectedAppForReason(null)}
          title={c.viewReasonModalTitle ?? "Application Details"}
        >
          <div className="space-y-4 pt-2">
            <div className="border border-line bg-surface/50 p-3 rounded-xs space-y-1 font-mono text-xs">
              <p><span className="text-muted">{c.appColOrg}:</span> <strong className="text-foreground">{selectedAppForReason.organizationName}</strong></p>
              <p><span className="text-muted">{c.appColWallet}:</span> {selectedAppForReason.walletAddress}</p>
              <p><span className="text-muted">{t.applyOrganizer.emailLabel}:</span> {selectedAppForReason.contactEmail}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-muted block">
                {c.appColReason}
              </label>
              <div className="p-3 border border-line bg-surface rounded-xs text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {selectedAppForReason.reason}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedAppForReason(null)}>
                {c.closeBtn ?? "Close"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Revocation Confirmation Modal */}
      {revokeTarget && (
        <Dialog
          isOpen={Boolean(revokeTarget)}
          onClose={closeRevokeModal}
          title={locale === "vi" ? "Xác nhận thu hồi quyền nhà tổ chức" : "Confirm Revoke Organizer Permission"}
        >
          <div className="space-y-5 pt-2">
            {/* Alert */}
            <div className="flex items-start gap-3 p-3 border border-destructive/30 bg-destructive/5 rounded-xs">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-muted leading-relaxed">
                {locale === "vi"
                  ? "Bạn sắp thu hồi quyền nhà tổ chức. Sau khi thu hồi, ví này sẽ không thể tạo round mới cho đến khi được phê duyệt lại."
                  : "You are about to revoke organizer permission. After revocation, this wallet will not be able to create new rounds until re-approved."}
              </p>
            </div>

            {/* Organizer info */}
            <div className="border border-line bg-surface/50 p-3 rounded-xs space-y-1.5 font-mono text-xs">
              <p>
                <span className="text-muted">{locale === "vi" ? "Tổ chức:" : "Organization:"}</span>{" "}
                <strong className="text-foreground">{revokeTarget.organizationName}</strong>
              </p>
              <p>
                <span className="text-muted">{locale === "vi" ? "Địa chỉ ví:" : "Wallet Address:"}</span>{" "}
                <span className="text-foreground break-all">{revokeTarget.walletAddress}</span>
              </p>
              <p>
                <span className="text-muted">Email:</span>{" "}
                <span className="text-foreground">{revokeTarget.contactEmail}</span>
              </p>
            </div>

            {/* Reason input */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted block">
                {locale === "vi" ? "Lí do thu hồi *" : "Revocation Reason *"}
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => { setRevokeReason(e.target.value); setRevokeError(null); }}
                placeholder={locale === "vi" ? "Nhập lí do thu hồi quyền nhà tổ chức..." : "Enter the reason for revoking organizer permission..."}
                rows={3}
                className="w-full bg-surface border border-line p-3 text-sm focus:outline-hidden focus:border-primary transition-colors resize-none placeholder:text-muted/60 rounded-xs"
                autoFocus
              />
              {revokeError && (
                <p className="text-xs text-destructive">{revokeError}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
              <Button type="button" variant="outline" onClick={closeRevokeModal}>
                {locale === "vi" ? "Huỷ" : "Cancel"}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleConfirmRevoke()}
                disabled={revokeReason.trim().length < 3}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                <UserX className="h-3.5 w-3.5 mr-1.5" />
                {locale === "vi" ? "Xác nhận thu hồi quyền" : "Confirm Revocation"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}


    </div>
  );
}

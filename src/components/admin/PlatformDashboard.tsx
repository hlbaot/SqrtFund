"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { isAddress, type Address, type Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { factoryAddress, TARGET_CHAIN_ID, ZERO_ADDRESS } from "@/lib/contracts/addresses";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { loadOrganizerRegistry, type OrganizerEntry } from "@/lib/organizerRegistry";
import { useTxFlow } from "@/hooks/useTxFlow";
import { useLocale } from "@/lib/context/locale";
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { shortAddress } from "@/lib/format";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatusAlert } from "@/components/ui/StatusAlert";
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
  ShieldCheck,
  ShieldAlert,
  Search,
  UserCheck,
  UserX,
  Copy,
  Check,
  RefreshCw,
  Award,
  Mail,
  Inbox,
} from "lucide-react";

interface PlatformDashboardProps {
  factoryOwner?: Address;
  isPlatformOwner: boolean;
  allRounds?: Address[];
  authorizationError?: boolean;
}

const EMPTY_ROUNDS: Address[] = [];

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

  // Form State
  const [targetAddress, setTargetAddress] = useState("");
  const [authorizeAction, setAuthorizeAction] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Checker State
  const [checkAddress, setCheckAddress] = useState("");
  const [checkResult, setCheckResult] = useState<{
    address: string;
    authorized: boolean;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Organizers Registry
  const [organizers, setOrganizers] = useState<OrganizerEntry[]>([]);
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState(false);
  const [historyStatus, setHistoryStatus] = useState({ complete: false, error: false });
  const registryBusy = useRef(false);
  const actionBusy = useRef(false);
  const approvalHashes = useRef(new Map<string, Hash>());
  // Luôn dùng toàn bộ đơn cho registry, kể cả khi đang lọc danh sách Chờ duyệt.
  const { applications: allApplications } = useOrganizerApplicationsAdmin("all");
  const knownWallets = allApplications.filter(app => app.status === "approved").map(app => app.walletAddress.toLowerCase()).sort().join(",");
  const knownAddresses = useMemo(() => knownWallets ? knownWallets.split(",") as Address[] : [], [knownWallets]);
  const pendingCount = allApplications.filter(app => app.status === "pending").length;
  const mergeOrganizers = useCallback((entries: OrganizerEntry[]) => {
    setOrganizers(previous => {
      const merged = new Map(previous.map(entry => [entry.address.toLowerCase(), entry]));
      entries.forEach(entry => merged.set(entry.address.toLowerCase(), entry));
      return [...merged.values()];
    });
  }, []);
  const registryRequest = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!publicClient || !knownAddresses.length) return;
    let active = true;
    // Không chờ lượt quét lịch sử đang chạy khi có đơn vừa được duyệt.
    void publicClient.multicall({
      contracts: knownAddresses.map(address => ({ address: factoryAddress, abi: roundFactoryAbi, functionName: "authorizedOrganizers" as const, args: [address] as const })),
      allowFailure: true,
    }).then(results => {
      if (!active) return;
      mergeOrganizers(knownAddresses.map((address, index) => ({ address, source: "manual", authorized: results[index]?.status === "success" ? Boolean(results[index].result) : undefined })));
    }).catch(() => { if (active) setRegistryError(true); });
    return () => { active = false; };
  }, [publicClient, knownAddresses, mergeOrganizers]);

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      if (isMounted.current) setCopiedKey(null);
    }, 1500);
  };

  // Lịch sử cấp/thu hồi lấy từ blockchain, không phụ thuộc localStorage.
  const refreshRegistry = useCallback(async () => {
    if (!publicClient || !factoryAddress || registryBusy.current) return;
    registryBusy.current = true;
    const request = ++registryRequest.current;
    setIsLoadingRegistry(true);
    setRegistryError(false);
    try {
      const entries = await loadOrganizerRegistry(publicClient, factoryAddress, allRounds, factoryOwner, {
        knownAddresses,
        onProgress: entries => {
          if (isMounted.current && request === registryRequest.current) mergeOrganizers(entries);
        },
        onHistoryStatus: (complete, error) => {
          if (isMounted.current && request === registryRequest.current) setHistoryStatus({ complete, error });
        },
      });
      if (isMounted.current && request === registryRequest.current) {
        mergeOrganizers(entries);
        setRegistryError(entries.some(entry => entry.authorized === undefined));
      }
    } catch {
      if (isMounted.current && request === registryRequest.current) setRegistryError(true);
    } finally {
      registryBusy.current = false;
      if (isMounted.current && request === registryRequest.current) setIsLoadingRegistry(false);
    }
  }, [publicClient, allRounds, factoryOwner, knownAddresses, mergeOrganizers]);

  useEffect(() => {
    void refreshRegistry();
    const timer = setInterval(() => void refreshRegistry(), 15_000);
    return () => clearInterval(timer);
  }, [refreshRegistry]);

  // Organizer Applications State
  const [appsFilter, setAppsFilter] = useState<string>("all");
  const [selectedAppForReason, setSelectedAppForReason] = useState<OrganizerApplication | null>(null);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const {
    applications,
    isLoading: isAppsLoading,
    isError: isAppsError,
    approveApplication,
    rejectApplication,
    refetch: refetchApps,
  } = useOrganizerApplicationsAdmin(appsFilter);

  const handleApproveApplication = async (app: OrganizerApplication) => {
    if (actionBusy.current) return;
    if (!isConnected || chainId !== TARGET_CHAIN_ID || !publicClient) {
      txToast.error("app-approve", "Please connect your wallet to Avalanche Fuji.");
      return;
    }
    if (!isPlatformOwner || authorizationError) {
      txToast.error("app-approve", c.platformOwnerOnlyAlert ?? "Only the Platform Owner can manage organizers.");
      return;
    }

    actionBusy.current = true;
    setBusyAppId(app.id);
    const flow = beginFlow("approve-application");
    const toastId = `approve-${app.id.slice(0, 8)}`;
    const title = c.grantingTitle ?? "Authorizing on Fuji...";

    let granted = false;
    try {
      // Khi giao dịch trước đã thành công nhưng PATCH lỗi, chỉ đồng bộ đơn.
      granted = await flow.wait(() => publicClient.readContract({ address: factoryAddress, abi: roundFactoryAbi, functionName: "authorizedOrganizers", args: [app.walletAddress as Address] }));
      let hash = approvalHashes.current.get(app.id);
      if (!granted) {
        flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
        hash = await flow.wait(() =>
          writeContractAsync({
            address: factoryAddress,
            abi: roundFactoryAbi,
            functionName: "setOrganizer",
            args: [app.walletAddress as Address, true],
            chainId: TARGET_CHAIN_ID,
          })
        );

        const confirmedHash = hash;
        const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: confirmedHash }), 120_000);
        if (receipt.status !== "success") {
          throw new Error("Transaction reverted on-chain");
        }
        approvalHashes.current.set(app.id, hash);
        granted = true;
      }

      mergeOrganizers([{ address: app.walletAddress as Address, source: "manual", authorized: true }]);
      await approveApplication(app.id, hash, address);
      flow.toast.success(toastId, c.grantSuccessTitle ?? "Organizer authorized on-chain & application approved!", shortAddress(app.walletAddress), hash);
      await Promise.all([refreshRegistry(), queries.invalidateQueries()]);
    } catch (error) {
      flow.toast.error(
        toastId,
        isUserRejected(error) ? t.wallet.connectionRejected : (locale === "vi" ? "Chưa hoàn tất phê duyệt" : "Approval incomplete"),
        granted
          ? (locale === "vi" ? "Quyền trên Fuji đã được cấp nhưng chưa cập nhật được đơn. Bấm duyệt lại để đồng bộ; không cần reload hoặc cấp quyền lần nữa." : "Permission is already granted on Fuji. Retry approval to sync the application without another grant transaction.")
          : getContractErrorMessage(error, locale)
      );
    } finally {
      flow.finish();
      actionBusy.current = false;
      if (isMounted.current) setBusyAppId(null);
    }
  };

  const handleRejectApplication = async (app: OrganizerApplication) => {
    if (actionBusy.current || !isPlatformOwner || authorizationError) return;
    if (!confirm(c.confirmRejectMsg ?? "Are you sure you want to reject this organizer application?")) {
      return;
    }
    actionBusy.current = true;
    setBusyAppId(app.id);
    try {
      await rejectApplication(app.id, address);
      txToast.info("app-reject", c.rejectSuccessTitle ?? "Application rejected.");
      await refetchApps();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to reject application";
      txToast.error("app-reject", msg);
    } finally {
      actionBusy.current = false;
      if (isMounted.current) setBusyAppId(null);
    }
  };

  // Execute Grant or Revoke Organizer
  const handleSetOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionBusy.current) return;
    setFormError(null);

    const trimmed = targetAddress.trim();
    if (!isAddress(trimmed)) {
      setFormError(c.invalidAddress ?? "Please enter a valid Ethereum address.");
      return;
    }
    if (trimmed.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      setFormError(c.zeroAddressError ?? "Zero address cannot be granted or revoked.");
      return;
    }

    if (!isConnected || chainId !== TARGET_CHAIN_ID || !publicClient) {
      setFormError("Please connect your wallet to Avalanche Fuji.");
      return;
    }

    if (!isPlatformOwner || authorizationError) {
      setFormError(c.platformOwnerOnlyAlert ?? "Only the Platform Owner can manage organizers.");
      return;
    }

    actionBusy.current = true;
    setIsSubmitting(true);
    const flow = beginFlow("set-organizer");
    const toastId = `organizer-${trimmed.slice(0, 8)}`;
    const title = authorizeAction
      ? (c.actionGrant ?? "Grant Organizer")
      : (c.actionRevoke ?? "Revoke Organizer");

    try {
      flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
      const hash = await flow.wait(() =>
        writeContractAsync({
          address: factoryAddress,
          abi: roundFactoryAbi,
          functionName: "setOrganizer",
          args: [trimmed as Address, authorizeAction],
          chainId: TARGET_CHAIN_ID,
        })
      );

      flow.toast.pending(
        toastId,
        title,
        authorizeAction
          ? (c.granting ?? "Authorizing on Fuji...")
          : (c.revoking ?? "Revoking on Fuji..."),
        hash
      );

      const receipt = await flow.wait(
        () => publicClient.waitForTransactionReceipt({ hash }),
        120_000
      );

      if (receipt.status !== "success") {
        throw new Error("Transaction reverted on chain.");
      }

      flow.toast.success(
        toastId,
        authorizeAction
          ? (c.grantSuccess ?? "Organizer permission granted successfully.")
          : (c.revokeSuccess ?? "Organizer permission revoked successfully."),
        shortAddress(trimmed),
        hash
      );

      setTargetAddress("");
      mergeOrganizers([{ address: trimmed as Address, source: "manual", authorized: authorizeAction }]);
      await queries.invalidateQueries();
      await refreshRegistry();

      // If user had checked this address, update check result
      if (checkResult && checkResult.address.toLowerCase() === trimmed.toLowerCase()) {
        setCheckResult({ address: trimmed, authorized: authorizeAction });
      }
    } catch (err) {
      if (!flow.cancelled) {
        const msg = isUserRejected(err)
          ? t.transactions.rejectedDescription
          : getContractErrorMessage(err, locale);
        setFormError(msg);
        flow.error(toastId, err, title, locale);
      }
    } finally {
      flow.finish();
      actionBusy.current = false;
      if (isMounted.current) setIsSubmitting(false);
    }
  };

  // Check Address Status
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError(null);
    setCheckResult(null);

    const trimmed = checkAddress.trim();
    if (!isAddress(trimmed)) {
      setCheckError(c.invalidAddress ?? "Please enter a valid Ethereum address.");
      return;
    }

    if (!publicClient) return;
    setIsChecking(true);

    try {
      const isAuth = await publicClient.readContract({
        address: factoryAddress,
        abi: roundFactoryAbi,
        functionName: "authorizedOrganizers",
        args: [trimmed as Address],
      });

      if (isMounted.current) {
        setCheckResult({ address: trimmed, authorized: Boolean(isAuth) });
      }
    } catch (err) {
      if (isMounted.current) {
        setCheckError(getContractErrorMessage(err, locale));
      }
    } finally {
      if (isMounted.current) setIsChecking(false);
    }
  };

  const populateForm = (addr: string, grant: boolean) => {
    setTargetAddress(addr);
    setAuthorizeAction(grant);
    setFormError(null);
  };

  return (
    <div className="space-y-8" data-aos="fade-up" data-aos-duration="600">
      {/* Platform Owner Status Alert */}
      {!isPlatformOwner && (
        <StatusAlert tone="warning" title={c.notPlatformOwner ?? "Not Platform Owner"}>
          {c.platformOwnerOnlyAlert ?? "Only the Platform Owner can grant or revoke organizer permissions."}
        </StatusAlert>
      )}

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

      {/* Two columns: Grant/Revoke Form & Status Checker */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Form: Grant / Revoke Organizer */}
        <section className="border border-line bg-surface p-5 space-y-5 rounded-sm">
          <div className="border-b border-line pb-3">
            <h3 className="text-sm font-bold text-foreground">
              {c.organizerSection ?? "Organizer Authorization"}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {c.organizerDesc ?? "Enter an address to grant or revoke round creation permissions."}
            </p>
          </div>

          <form onSubmit={handleSetOrganizer} className="space-y-4">
            {/* Action Selector */}
            <div className="space-y-1.5">
              <label className="mono-label text-xs text-muted block">
                {locale === "vi" ? "Hành động" : "Action"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthorizeAction(true)}
                  className={`mono-label py-2 px-3 text-xs border rounded-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    authorizeAction
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-line bg-surface-2 hover:border-line-strong text-muted"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {c.actionGrant ?? "Grant Organizer"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthorizeAction(false)}
                  className={`mono-label py-2 px-3 text-xs border rounded-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    !authorizeAction
                      ? "border-destructive/80 bg-destructive/10 text-destructive font-bold"
                      : "border-line bg-surface-2 hover:border-line-strong text-muted"
                  }`}
                >
                  <UserX className="h-3.5 w-3.5" />
                  {c.actionRevoke ?? "Revoke Organizer"}
                </button>
              </div>
            </div>

            {/* Address Input */}
            <Input
              label={c.organizerAddressLabel ?? "Organizer Wallet Address"}
              type="text"
              placeholder={c.organizerAddressPlaceholder ?? "0x..."}
              value={targetAddress}
              onChange={(e) => {
                setTargetAddress(e.target.value);
                if (formError) setFormError(null);
              }}
              error={formError || undefined}
              required
            />

            {/* Business rules helper */}
            <div className="border border-line-strong/30 bg-surface-2/20 p-3 rounded-xs text-[11px] text-muted space-y-1">
              <p className="font-semibold text-foreground">
                {authorizeAction
                  ? (locale === "vi" ? "Quyền hạn khi cấp:" : "Granted permissions:")
                  : (locale === "vi" ? "Ảnh hưởng khi thu hồi:" : "Revocation impact:")}
              </p>
              <p>
                {authorizeAction
                  ? (locale === "vi"
                      ? "Ví này sẽ được phép gọi createRound để tạo nhiều vòng QFRound độc lập với pool và admin riêng (BR-03, BR-05)."
                      : "This wallet can call createRound to deploy multiple independent QFRound contracts with its own pool and admin.")
                  : (locale === "vi"
                      ? "Thu hồi chỉ chặn tạo vòng mới; các vòng đã triển khai trước đó và quyền admin của chúng không bị thay đổi (BR-08)."
                      : "Revocation only blocks creating new rounds; existing deployed rounds and their admin authority remain untouched.")}
              </p>
            </div>

            <Button
              type="submit"
              variant={authorizeAction ? "primary" : "destructive"}
              fullWidth
              disabled={isSubmitting || busyAppId !== null || authorizationError || !isPlatformOwner || !targetAddress.trim()}
              isLoading={isSubmitting}
              className="text-xs font-bold py-2.5"
            >
              {isSubmitting
                ? authorizeAction
                  ? (c.granting ?? "Authorizing on Fuji...")
                  : (c.revoking ?? "Revoking on Fuji...")
                : authorizeAction
                ? (c.btnGrant ?? "Grant Permission")
                : (c.btnRevoke ?? "Revoke Permission")}
            </Button>
          </form>
        </section>

        {/* Tool: Check Status */}
        <section className="border border-line bg-surface p-5 space-y-5 rounded-sm">
          <div className="border-b border-line pb-3">
            <h3 className="text-sm font-bold text-foreground">
              {c.checkTitle ?? "Check Organizer Status"}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {c.checkDesc ?? "Verify if an address currently has permission to deploy rounds."}
            </p>
          </div>

          <form onSubmit={handleCheckStatus} className="space-y-4">
            <Input
              label={locale === "vi" ? "Địa chỉ ví cần kiểm tra" : "Address to verify"}
              type="text"
              placeholder="0x..."
              value={checkAddress}
              onChange={(e) => {
                setCheckAddress(e.target.value);
                if (checkError) setCheckError(null);
              }}
              error={checkError || undefined}
              required
            />

            <Button
              type="submit"
              variant="outline"
              fullWidth
              disabled={isChecking || !checkAddress.trim()}
              isLoading={isChecking}
              className="text-xs font-bold py-2"
            >
              <Search className="h-3.5 w-3.5 mr-1" />
              {isChecking ? (c.statusChecking ?? "Checking...") : (c.checkBtn ?? "Check status")}
            </Button>

            {/* Verification Result Card */}
            {checkResult && (
              <div
                className={`border p-4 rounded-xs space-y-3 ${
                  checkResult.authorized
                    ? "border-primary/40 bg-primary/5"
                    : "border-line bg-surface-2/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="mono-label text-xs text-foreground font-mono truncate">
                    {shortAddress(checkResult.address)}
                  </span>
                  {checkResult.authorized ? (
                    <Badge variant="primary" className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {c.statusAuthorized ?? "Authorized Organizer"}
                    </Badge>
                  ) : (
                    <Badge variant="default" className="flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      {c.statusUnauthorized ?? "Not authorized / Revoked"}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {checkResult.authorized ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => populateForm(checkResult.address, false)}
                      className="text-[11px] py-1 px-2.5 h-auto"
                    >
                      {c.fillToRevoke ?? "Select to revoke"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => populateForm(checkResult.address, true)}
                      className="text-[11px] py-1 px-2.5 h-auto"
                    >
                      {c.fillToGrant ?? "Select to grant"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </section>
      </div>

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
              {(["all", "pending", "approved", "rejected"] as const).map(filterKey => {
                const label = filterKey === "all" ? c.filterAll : filterKey === "pending" ? c.filterPending : filterKey === "approved" ? c.filterApproved : c.filterRejected;
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setAppsFilter(filterKey)}
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

        {isAppsError && <StatusAlert tone="error" title={locale === "vi" ? "Không tải được đơn đăng ký" : "Could not load applications"}>
          {locale === "vi" ? "Đang tự thử lại. Bạn cũng có thể bấm Làm mới để kiểm tra lại kết nối." : "Retrying automatically. You can also refresh to retry."}
        </StatusAlert>}
        {applications.length === 0 ? (
          <p className="text-xs text-muted py-8 text-center">
            {isAppsLoading ? (locale === "vi" ? "Đang tải đơn đăng ký..." : "Loading applications...") : isAppsError ? "—" : (c.noApplications ?? "No applications found.")}
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
              {applications.map((app) => {
                const isPending = app.status === "pending";
                const isApproved = app.status === "approved";
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
                            disabled={busyAppId !== null || isSubmitting || !isPlatformOwner || authorizationError}
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
                            disabled={busyAppId !== null || isSubmitting || !isPlatformOwner || authorizationError}
                            onClick={() => void handleRejectApplication(app)}
                            className="text-xs py-1 px-2.5 h-auto text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            {c.btnReject}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted font-mono">
                          {isApproved
                            ? organizers.find(org => org.address.toLowerCase() === app.walletAddress.toLowerCase())?.authorized === true
                              ? "On-chain Active"
                              : (locale === "vi" ? "Xem quyền hiện tại bên dưới" : "See current permissions below")
                            : "Declined"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

      {/* Known Organizers Table */}
      <section className="border border-line bg-surface p-5 space-y-4 rounded-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {c.organizersListTitle ?? "Organizer Registry & History"}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {locale === "vi"
                ? "Danh sách các ví Organizer đã được ghi nhận và trạng thái on-chain hiện tại."
                : "Recorded organizer wallets and their current on-chain authorization status."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void refreshRegistry()}
            disabled={isLoadingRegistry}
            className="text-xs text-muted hover:text-foreground self-start sm:self-auto"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingRegistry ? "animate-spin" : ""}`} />
            {locale === "vi" ? "Làm mới" : "Refresh"}
          </Button>
        </div>

        {(registryError || organizers.some(org => org.authorized === undefined)) && <StatusAlert tone="error" title={locale === "vi" ? "Không tải đầy đủ quyền Organizer" : "Organizer permissions could not be fully loaded"}>
          {locale === "vi" ? "Dữ liệu có thể chưa cập nhật. Bấm Làm mới để thử lại; lỗi đọc không có nghĩa là quyền đã bị thu hồi." : "Data may be outdated. Refresh to retry; a failed read does not mean permissions were revoked."}
        </StatusAlert>}
        {!historyStatus.complete && <StatusAlert tone={historyStatus.error ? "warning" : "info"} title={locale === "vi" ? "Đang bổ sung lịch sử Organizer" : "Loading additional organizer history"}>
          {locale === "vi"
            ? (historyStatus.error ? "RPC chưa trả đủ lịch sử. Các ví đã biết vẫn được kiểm tra quyền trực tiếp; hệ thống sẽ tự thử lại." : "Hệ thống đang quét lịch sử theo giới hạn RPC Fuji. Các ví đã biết được hiển thị trước và danh sách tự cập nhật.")
            : "History is scanned in batches within Fuji RPC limits. Known wallets are checked directly; the list updates automatically."}
        </StatusAlert>}
        {authorizationError && <StatusAlert tone="warning" title={locale === "vi" ? "Factory chưa sẵn sàng cho Multi-Organizer" : "Factory authorization unavailable"}>
          {locale === "vi" ? "Kiểm tra RPC và cấu hình Factory đã deploy, đặc biệt giá trị ghi đè trong .env.local." : "Check the RPC and verified Factory configuration, including .env.local overrides."}
        </StatusAlert>}
        {organizers.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">
            {isLoadingRegistry
              ? (locale === "vi" ? "Đang tải danh sách..." : "Loading registry...")
              : (c.organizersListEmpty ?? "No organizers recorded yet. Use the form above to grant permissions.")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="role-label">{c.colOrganizerAddress ?? "Address"}</TableHead>
                <TableHead className="role-label">{c.colOrganizerStatus ?? "Status"}</TableHead>
                <TableHead className="role-label text-right">{c.colOrganizerActions ?? "Action"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizers.map((org) => {
                const isOwner = org.address.toLowerCase() === factoryOwner?.toLowerCase();
                return (
                  <TableRow key={org.address}>
                    <TableCell className="font-mono text-foreground text-xs">
                      <div className="flex items-center gap-2">
                        <span>{shortAddress(org.address, 6)}</span>
                        {isOwner && (
                          <Badge variant="primary" className="text-[10px] px-1 py-0">
                            Owner
                          </Badge>
                        )}
                        <ExplorerLink address={org.address} iconOnly />
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.authorized === undefined && !isOwner ? (
                        <Badge variant="default">{locale === "vi" ? "Chưa xác định" : "Unknown"}</Badge>
                      ) : org.authorized || isOwner ? (
                        <Badge variant="primary" className="text-[11px]">
                          {c.statusAuthorized ?? "Authorized"}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[11px]">
                          {c.statusUnauthorized ?? "Unauthorized"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isPlatformOwner && !isOwner && !authorizationError && org.authorized !== undefined && (
                        <button
                          type="button"
                          onClick={() => populateForm(org.address, !org.authorized)}
                          className="mono-label text-xs underline underline-offset-4 text-muted hover:text-foreground cursor-pointer transition-colors"
                        >
                          {org.authorized
                            ? (c.actionRevoke ?? "Revoke")
                            : (c.actionGrant ?? "Grant")}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

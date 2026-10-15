"use client";

import React, { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { isAddress, type Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { useTxFlow } from "@/hooks/useTxFlow";
import { useLocale } from "@/lib/context/locale";
import { usePendingRequests } from "@/hooks/usePendingRequests";
import { txToast } from "@/lib/txToast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
import { shortAddress, formatTimeAgo } from "@/lib/format";
import { Check, X, UserPlus, Copy, CheckCheck, Loader2 } from "lucide-react";

export function WhitelistTable() {
  const beginFlow = useTxFlow();
  const now = useCurrentTimestamp();
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress } = useRound();

  const [limit, setLimit] = useState<bigint>(20n);
  const { requesters, totalCount, requestedAt, isLoading, refetch } = usePendingRequests(0n, limit);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [isManualPending, setIsManualPending] = useState(false);
  const [selectedAddresses, setSelectedAddresses] = useState<Set<Address>>(new Set());
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const handleCopy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    } catch {
      // ignore
    }
  };

  const toggleSelect = (addr: Address) => {
    setSelectedAddresses((prev) => {
      const next = new Set(prev);
      if (next.has(addr)) {
        next.delete(addr);
      } else {
        if (next.size < 50) next.add(addr);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (requesters.length > 0 && requesters.slice(0, 50).every(account => selectedAddresses.has(account))) {
      setSelectedAddresses(new Set());
    } else {
      setSelectedAddresses(new Set(requesters.slice(0, 50)));
    }
  };

  const handleSetWhitelist = async (account: Address, status: boolean) => {
    const flow = beginFlow();
    if (!roundAddress || !publicClient) return;

    const actionType = status ? "approve" : "reject";
    const toastId = `${actionType}-${account.toLowerCase()}`;
    setPendingActionId(toastId);

    try {
      flow.toast.pending(
        toastId,
        status
          ? t.toasts.approvingStudentTitle
          : t.toasts.rejectingStudentTitle,
        status
          ? t.toasts.updatingWhitelist.replace("{address}", shortAddress(account))
          : t.toasts.rejectingStudentDesc.replace("{address}", shortAddress(account))
      );

      const hash = await flow.wait(() =>
        writeContractAsync({
          address: roundAddress,
          abi: qfRoundAbi,
          functionName: "setWhitelist",
          args: [account, status],
        })
      );

      flow.toast.pending(
        toastId,
        t.toasts.confirmingApprovalTitle,
        t.toasts.confirmingOnChain,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("setWhitelist transaction reverted.");
      }

      flow.toast.success(
        toastId,
        status
          ? t.toasts.studentApprovedTitle
          : t.toasts.studentRejectedTitle,
        status
          ? t.toasts.studentApprovedDesc.replace("{address}", shortAddress(account))
          : t.toasts.studentRejectedDesc.replace("{address}", shortAddress(account)),
        hash
      );

      setSelectedAddresses((prev) => {
        const next = new Set(prev);
        next.delete(account);
        return next;
      });

      await flow.wait(() => Promise.all([refetch(), queryClient.invalidateQueries()]));
      return true;
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.whitelistFailed,
        locale
      );
      return false;
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setPendingActionId(null);
      }
    }
  };

  const handleApproveBatch = async () => {
    if (selectedAddresses.size === 0 || !roundAddress || !publicClient) return;

    const flow = beginFlow("approve-batch");
    const toastId = "approve-batch";
    const accounts = Array.from(selectedAddresses).filter(account => requesters.includes(account)).slice(0, 50);
    if (accounts.length === 0) { flow.finish(); return; }
    const statuses = Array(accounts.length).fill(true);

    setPendingActionId(toastId);
    try {
      flow.toast.pending(
        toastId,
        t.toasts.batchApprovingTitle.replace("{count}", String(accounts.length)),
        t.toasts.batchApprovingDesc
      );

      const hash = await flow.wait(() =>
        writeContractAsync({
          address: roundAddress,
          abi: qfRoundAbi,
          functionName: "setWhitelistBatch",
          args: [accounts, statuses],
        })
      );

      flow.toast.pending(
        toastId,
        t.toasts.confirmingApprovalTitle,
        t.toasts.confirmingOnChain,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("setWhitelistBatch transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.toasts.batchApprovedTitle,
        t.toasts.batchApprovedDesc.replace("{count}", String(accounts.length)),
        hash
      );

      setSelectedAddresses(previous => new Set([...previous].filter(account => !accounts.includes(account))));
      await flow.wait(() => Promise.all([refetch(), queryClient.invalidateQueries()]));
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.batchApprovalFailed,
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setPendingActionId(null);
      }
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const manualToastId = "whitelist-manual";
    const trimmed = manualAddress.trim();

    if (!isAddress(trimmed)) {
      txToast.error(
        manualToastId,
        t.toasts.invalidAddressTitle,
        t.toasts.invalidAddressDesc
      );
      return;
    }

    if (!roundAddress || !publicClient) return;

    const flow = beginFlow("manual-whitelist");
    setIsManualPending(true);
    try {
      const alreadyWhitelisted = await flow.wait(() => publicClient.readContract({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "isWhitelisted",
        args: [trimmed as Address],
      }));
      if (alreadyWhitelisted) {
        flow.toast.error(manualToastId, t.verification.alreadyWhitelisted);
        return;
      }
      const succeeded = await flow.wait(() => handleSetWhitelist(trimmed as Address, true));
      if (succeeded) setManualAddress("");
    } catch (error) {
      if (!flow.cancelled) flow.error(manualToastId, error, t.common.error, locale);
    } finally {
      flow.finish();
      if (!flow.cancelled) setIsManualPending(false);
    }
  };

  const allSelected = requesters.length > 0 && requesters.slice(0, 50).every(account => selectedAddresses.has(account));

  return (
    <div className="border border-line bg-surface p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">
            {t.admin.whitelistTitle}
          </h3>
          <p className="text-xs text-muted">
            {t.verification.queueDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedAddresses.size > 0 && (
            <Button
              size="sm"
              variant="accent"
              onClick={handleApproveBatch}
              disabled={Boolean(pendingActionId)}
              isLoading={pendingActionId === "approve-batch"}
              className="h-8 text-xs font-semibold"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {t.verification.approveSelected} ({selectedAddresses.size})
            </Button>
          )}
          <span className="mono-label text-xs border border-line px-2.5 py-1 text-muted">
            {totalCount} {t.verification.pendingRequesters.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Manual whitelist input */}
      <form onSubmit={handleManualAdd} className="flex gap-2 items-center">
        <div className="flex-1">
          <Input
            placeholder={t.verification.directWallet}
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isManualPending || Boolean(pendingActionId) || !manualAddress.trim()}
          isLoading={isManualPending}
          className="text-xs font-bold shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          {t.verification.addWhitelist}
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-2 py-4">
          <div className="text-center text-xs text-muted mb-3 flex items-center justify-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t.verification.loadingRequests}</span>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-bg/50 border border-line/40 rounded animate-pulse" />
          ))}
        </div>
      ) : requesters.length === 0 ? (
        <div className="border border-line bg-bg p-8 text-center text-xs text-muted">
          {t.verification.noPending}
        </div>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t.verification.selectAll}
                    className="h-4 w-4 rounded border-line bg-bg text-primary focus:ring-primary accent-primary cursor-pointer"
                  />
                </TableHead>
                <TableHead className="role-label">{t.admin.colAddress}</TableHead>
                <TableHead className="role-label">{t.verification.time}</TableHead>
                <TableHead className="role-label">{t.admin.colStatus}</TableHead>
                <TableHead className="text-right role-label">{t.admin.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requesters.map((addr) => {
                const lower = addr.toLowerCase();
                const approveToastId = `approve-${lower}`;
                const rejectToastId = `reject-${lower}`;
                const isApproving = pendingActionId === approveToastId;
                const isRejecting = pendingActionId === rejectToastId;
                const isBusy = Boolean(pendingActionId);
                const reqTime = requestedAt[lower];
                const timeText = reqTime && now > 0
                  ? formatTimeAgo(reqTime, locale, now * 1000)
                  : t.verification.unknownTime;

                return (
                  <TableRow key={addr}>
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedAddresses.has(addr)}
                        disabled={!selectedAddresses.has(addr) && selectedAddresses.size >= 50}
                        onChange={() => toggleSelect(addr)}
                        aria-label={`${t.verification.selectRow} ${addr}`}
                        className="h-4 w-4 rounded border-line bg-bg text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar address={addr} size={32} forceAuto />
                        <span className="font-mono text-xs font-medium text-foreground">
                          {shortAddress(addr)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(addr)}
                          title={t.common.copyAddress}
                          className="text-muted hover:text-foreground transition-colors p-1"
                        >
                          {copiedAddr === addr ? (
                            <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <ExplorerLink address={addr} />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted font-mono whitespace-nowrap">
                      {timeText}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">{t.verification.pendingApproval}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={isBusy}
                          isLoading={isApproving}
                          onClick={() => handleSetWhitelist(addr, true)}
                          className="h-7 px-2.5 text-xs font-semibold"
                          title={t.verification.approve}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          <span>{t.verification.approve}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          isLoading={isRejecting}
                          onClick={() => handleSetWhitelist(addr, false)}
                          className="h-7 px-2.5 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          title={t.verification.reject}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          <span>{t.verification.reject}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalCount > requesters.length && (
            <div className="pt-2 flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLimit((prev) => prev + 20n)}
                className="text-xs"
              >
                {t.verification.loadMore}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

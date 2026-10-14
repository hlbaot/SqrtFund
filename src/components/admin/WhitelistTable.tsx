"use client";

import React, { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { isAddress, type Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
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
        next.add(addr);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAddresses.size === requesters.length && requesters.length > 0) {
      setSelectedAddresses(new Set());
    } else {
      setSelectedAddresses(new Set(requesters));
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
          ? locale === "vi" ? "Đang duyệt sinh viên..." : "Approving student..."
          : locale === "vi" ? "Đang từ chối sinh viên..." : "Rejecting student...",
        locale === "vi"
          ? `Đang cập nhật trạng thái whitelist cho ${shortAddress(account)}.`
          : `Updating whitelist status for ${shortAddress(account)}.`
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
        locale === "vi" ? "Đang xác nhận trên chuỗi..." : "Confirming on chain...",
        locale === "vi" ? "Đang chờ xác nhận khối trên Avalanche Fuji." : "Waiting for block confirmation on Avalanche Fuji.",
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("setWhitelist transaction reverted.");
      }

      flow.toast.success(
        toastId,
        status
          ? locale === "vi" ? "Đã duyệt sinh viên!" : "Student Approved!"
          : locale === "vi" ? "Đã từ chối sinh viên" : "Student Rejected",
        locale === "vi"
          ? `${shortAddress(account)} đã được ${status ? "thêm vào whitelist" : "xoá khỏi hàng chờ"}.`
          : `${shortAddress(account)} has been ${status ? "whitelisted" : "removed from queue"}.`,
        hash
      );

      setSelectedAddresses((prev) => {
        const next = new Set(prev);
        next.delete(account);
        return next;
      });

      refetch();
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Cập nhật danh sách thất bại" : "Whitelist update failed",
        locale
      );
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
    const accounts = Array.from(selectedAddresses);
    const statuses = Array(accounts.length).fill(true);

    setPendingActionId(toastId);
    try {
      flow.toast.pending(
        toastId,
        locale === "vi" ? `Đang duyệt ${accounts.length} sinh viên...` : `Approving ${accounts.length} students...`,
        locale === "vi" ? "Đang chuẩn bị giao dịch gom nhiều địa chỉ." : "Preparing batch approval transaction."
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
        locale === "vi" ? "Đang xác nhận trên chuỗi..." : "Confirming on chain...",
        locale === "vi" ? "Đang chờ xác nhận khối trên Avalanche Fuji." : "Waiting for block confirmation on Avalanche Fuji.",
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("setWhitelistBatch transaction reverted.");
      }

      flow.toast.success(
        toastId,
        locale === "vi" ? "Duyệt hàng loạt thành công!" : "Batch Approval Successful!",
        locale === "vi"
          ? `Đã duyệt thành công ${accounts.length} sinh viên.`
          : `Successfully approved ${accounts.length} students.`,
        hash
      );

      setSelectedAddresses(new Set());
      refetch();
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Duyệt hàng loạt thất bại" : "Batch approval failed",
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
        locale === "vi" ? "Địa chỉ không hợp lệ" : "Invalid address",
        locale === "vi" ? "Vui lòng nhập địa chỉ 0x hợp lệ." : "Please enter a valid 0x address."
      );
      return;
    }

    if (!roundAddress || !publicClient) return;

    try {
      const alreadyWhitelisted = await publicClient.readContract({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "isWhitelisted",
        args: [trimmed as Address],
      });

      if (alreadyWhitelisted) {
        txToast.error(
          manualToastId,
          locale === "vi" ? "Đã được whitelist" : "Already Whitelisted",
          t.verification.alreadyWhitelisted
        );
        return;
      }
    } catch {
      // Continue to setWhitelist
    }

    const flow = beginFlow("manual-whitelist");
    setIsManualPending(true);
    try {
      await flow.wait(() => handleSetWhitelist(trimmed as Address, true));
      setManualAddress("");
    } catch {
      // Managed in handleSetWhitelist
    } finally {
      flow.finish();
      if (!flow.cancelled) setIsManualPending(false);
    }
  };

  const allSelected = requesters.length > 0 && selectedAddresses.size === requesters.length;

  return (
    <div className="border border-line bg-surface p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">
            {t.admin.whitelistTitle}
          </h3>
          <p className="text-xs text-muted">
            Pending student verification requests on Avalanche Fuji (max 500 in queue).
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
            placeholder="Direct whitelist wallet (0x...)"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isManualPending || !manualAddress.trim()}
          isLoading={isManualPending}
          className="text-xs font-bold shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Add Whitelist
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
                    aria-label="Select all requesters"
                    className="h-4 w-4 rounded border-line bg-bg text-primary focus:ring-primary accent-primary cursor-pointer"
                  />
                </TableHead>
                <TableHead>{t.admin.colAddress}</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>{t.admin.colStatus}</TableHead>
                <TableHead className="text-right">{t.admin.colActions}</TableHead>
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
                const timeText = reqTime
                  ? formatTimeAgo(reqTime, locale)
                  : locale === "vi"
                  ? "Vừa xong"
                  : "Just now";

                return (
                  <TableRow key={addr}>
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedAddresses.has(addr)}
                        onChange={() => toggleSelect(addr)}
                        aria-label={`Select ${addr}`}
                        className="h-4 w-4 rounded border-line bg-bg text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {shortAddress(addr)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(addr)}
                          title="Copy address"
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
                {locale === "vi" ? "Xem thêm" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

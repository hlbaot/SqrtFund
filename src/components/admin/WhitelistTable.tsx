"use client";

import { useTxFlow } from "@/hooks/useTxFlow";
import React, { useState } from "react";
import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useLocale } from "@/lib/context/locale";
import { txToast } from "@/lib/txToast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { shortAddress } from "@/lib/format";
import { Check, X, UserPlus } from "lucide-react";
import type { Address } from "viem";

export function WhitelistTable() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress } = useRound();

  const [pendingActionAddr, setPendingActionAddr] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [isManualPending, setIsManualPending] = useState(false);

  // Read pending requesters from contract
  const { data: requestersData, isLoading, refetch } = useReadContract({
    address: roundAddress,
    abi: qfRoundAbi,
    functionName: "getRequesters",
    args: [0n, 50n],
    query: {
      enabled: Boolean(roundAddress),
      refetchInterval: 5000,
    },
  });

  const requesters = (requestersData?.[0] as readonly Address[] | undefined) ?? [];
  const totalRequesters = Number(requestersData?.[1] ?? 0n);

  const handleSetWhitelist = async (account: Address, status: boolean) => {
    const flow = beginFlow();
    if (!roundAddress || !publicClient) return;

    const toastId = `whitelist-${account.toLowerCase()}`;
    setPendingActionAddr(account);
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

      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "setWhitelist",
        args: [account, status],
      }));

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
        setPendingActionAddr(null);
      }
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const manualToastId = "whitelist-manual";
    if (!manualAddress.trim().startsWith("0x") || manualAddress.length !== 42) {
      txToast.error(
        manualToastId,
        locale === "vi" ? "Địa chỉ không hợp lệ" : "Invalid address",
        locale === "vi" ? "Vui lòng nhập địa chỉ 0x hợp lệ." : "Please enter a valid 0x address."
      );
      return;
    }
    const flow = beginFlow("manual-whitelist");
    setIsManualPending(true);
    try {
      await flow.wait(() => handleSetWhitelist(manualAddress.trim() as Address, true));
      setManualAddress("");
    } catch {
      // The transaction step reports failures; cancellation only stops this form.
    } finally {
      flow.finish();
      if (!flow.cancelled) setIsManualPending(false);
    }
  };

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
        <span className="mono-label text-xs border border-line px-2.5 py-1 text-muted">
          {totalRequesters} pending requesters
        </span>
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
          disabled={isManualPending || !manualAddress}
          isLoading={isManualPending}
          className="text-xs font-bold shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Add Whitelist
        </Button>
      </form>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-muted">Loading pending verification requests...</div>
      ) : requesters.length === 0 ? (
        <div className="border border-line bg-bg p-8 text-center text-xs text-muted">
          No pending student verification requests at this time.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.admin.colAddress}</TableHead>
              <TableHead>{t.admin.colStatus}</TableHead>
              <TableHead className="text-right">{t.admin.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requesters.map((addr) => {
              const isBusy = pendingActionAddr === addr;
              return (
                <TableRow key={addr}>
                  <TableCell className="font-mono text-xs font-medium text-foreground">
                    {addr}
                  </TableCell>
                  <TableCell>
                    <Badge variant="warning">Pending Request</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={Boolean(pendingActionAddr)}
                        isLoading={isBusy}
                        onClick={() => handleSetWhitelist(addr, true)}
                        className="h-7 px-2.5 text-xs font-semibold"
                        title={t.admin.approveBtn}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        <span>{t.admin.approveBtn}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(pendingActionAddr)}
                        onClick={() => handleSetWhitelist(addr, false)}
                        className="h-7 px-2.5 text-xs text-primary hover:text-foreground hover:bg-primary/10"
                        title={t.admin.rejectBtn}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        <span>{t.admin.rejectBtn}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

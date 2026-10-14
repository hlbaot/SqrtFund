"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { factoryAddress, usdcAddress } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Format Date object to YYYY-MM-DDTHH:mm string in local timezone */
function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function CreateRoundForm() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { refetch } = useRound();

  const [roundName, setRoundName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [organizerError, setOrganizerError] = useState<string | null>(null);

  const [startDateTime, setStartDateTime] = useState(() => {
    if (typeof window === "undefined") return "";
    return toLocalDatetimeString(new Date(Date.now() + 2 * 60 * 1000));
  });
  const [endDateTime, setEndDateTime] = useState(() => {
    if (typeof window === "undefined") return "";
    return toLocalDatetimeString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  });
  const [tzLabel] = useState(() => {
    if (typeof window === "undefined") return "";
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const mins = Math.abs(offsetMinutes) % 60;
    return `GMT${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, "0")}` : ""}`;
  });
  const [minDonationUsdc, setMinDonationUsdc] = useState("1");
  const [maxDonationUsdc, setMaxDonationUsdc] = useState("5");
  const [maxMatchPercent, setMaxMatchPercent] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roundNameBytes = React.useMemo(
    () => new TextEncoder().encode(roundName.trim()).length,
    [roundName]
  );
  const organizerBytes = React.useMemo(
    () => new TextEncoder().encode(organizer.trim()).length,
    [organizer]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    const flow = beginFlow();
    e.preventDefault();
    const toastId = "create-round";

    if (!isConnected || !factoryAddress || !publicClient) {
      flow.toast.error(
        toastId,
        locale === "vi" ? "Factory chưa sẵn sàng" : "Factory not ready",
        locale === "vi" ? "Vui lòng kết nối ví sở hữu factory." : "Please connect the factory owner wallet."
      );
      return;
    }

    const trimmedName = roundName.trim();
    const trimmedOrg = organizer.trim();
    const nBytes = new TextEncoder().encode(trimmedName).length;
    const oBytes = new TextEncoder().encode(trimmedOrg).length;

    let hasValidationErr = false;
    if (nBytes === 0) {
      setNameError(t.admin.validationRoundNameRequired);
      hasValidationErr = true;
    } else if (nBytes > 60) {
      setNameError(t.admin.validationRoundNameTooLong);
      hasValidationErr = true;
    } else {
      setNameError(null);
    }

    if (oBytes > 60) {
      setOrganizerError(t.admin.validationOrganizerTooLong);
      hasValidationErr = true;
    } else {
      setOrganizerError(null);
    }

    if (hasValidationErr) return;

    if (!startDateTime || !endDateTime) {
      flow.toast.error(
        toastId,
        locale === "vi" ? "Lịch trình không hợp lệ" : "Invalid schedule",
        locale === "vi" ? "Vui lòng nhập ngày bắt đầu và kết thúc." : "Please enter start and end dates."
      );
      return;
    }

    const startTimestamp = BigInt(Math.floor(new Date(startDateTime).getTime() / 1000));
    const endTimestamp = BigInt(Math.floor(new Date(endDateTime).getTime() / 1000));

    if (endTimestamp <= startTimestamp) {
      flow.toast.error(
        toastId,
        locale === "vi" ? "Lịch trình không hợp lệ" : "Invalid schedule",
        locale === "vi" ? "Thời gian kết thúc phải sau thời gian bắt đầu." : "End time must be after start time."
      );
      return;
    }

    const minDonation = BigInt(Math.round(parseFloat(minDonationUsdc) * 1_000_000));
    const maxDonation = BigInt(Math.round(parseFloat(maxDonationUsdc) * 1_000_000));
    const maxMatchBps = BigInt(Math.round(parseFloat(maxMatchPercent) * 100));

    setIsSubmitting(true);
    try {
      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang tạo round QF..." : "Creating QF Round...",
        locale === "vi" ? "Vui lòng xác nhận trong ví của bạn." : "Please confirm in your wallet."
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: factoryAddress,
        abi: roundFactoryAbi,
        functionName: "createRound",
        args: [
          trimmedName,
          trimmedOrg,
          usdcAddress,
          startTimestamp,
          endTimestamp,
          minDonation,
          maxDonation,
          maxMatchBps,
        ],
      }));

      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang xác nhận triển khai..." : "Confirming round deployment...",
        locale === "vi"
          ? "Đang triển khai hợp đồng QFRound trên Avalanche Fuji."
          : "Deploying QFRound smart contract on Avalanche Fuji.",
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("createRound transaction reverted.");
      }

      flow.toast.success(
        toastId,
        locale === "vi" ? "Tạo round thành công!" : "Round deployed successfully!",
        locale === "vi" ? "Hợp đồng QFRound mới đã hoạt động trên Fuji." : "New QFRound contract is live on Fuji.",
        hash
      );

      setRoundName("");
      setOrganizer("");
      refetch();
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Tạo round thất bại" : "Failed to create round",
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="border border-line bg-surface p-6 space-y-4 max-w-[720px]">
      <div>
        <h3 className="text-base font-bold text-foreground tracking-tight">
          {t.admin.createRoundTitle}
        </h3>
        <p className="text-xs text-muted">
          Deploy a new QFRound contract via the RoundFactory on Avalanche Fuji.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-3">
          <Input
            label={`${t.admin.roundNameLabel} *`}
            type="text"
            value={roundName}
            onChange={(e) => {
              setRoundName(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder={t.admin.roundNamePlaceholder}
            suffixElement={
              <span
                className={`tabular-mono text-xs ${roundNameBytes > 60 ? "text-primary font-bold" : "text-muted"
                  }`}
              >
                {roundNameBytes}/60B
              </span>
            }
            error={
              nameError ||
              (roundNameBytes > 60 ? t.admin.validationRoundNameTooLong : undefined)
            }
            required
          />

          <Input
            label={`${t.admin.organizerLabel} (${t.admin.optionalLabel})`}
            type="text"
            value={organizer}
            onChange={(e) => {
              setOrganizer(e.target.value);
              if (organizerError) setOrganizerError(null);
            }}
            placeholder={t.admin.organizerPlaceholder}
            suffixElement={
              <span
                className={`tabular-mono text-xs ${organizerBytes > 60 ? "text-primary font-bold" : "text-muted"
                  }`}
              >
                {organizerBytes}/60B
              </span>
            }
            error={
              organizerError ||
              (organizerBytes > 60 ? t.admin.validationOrganizerTooLong : undefined)
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={`Start Date & Time${tzLabel ? ` (${tzLabel})` : ""}`}
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            helperText="Local time (auto-converted to on-chain Unix timestamp)"
            required
          />
          <Input
            label={`End Date & Time${tzLabel ? ` (${tzLabel})` : ""}`}
            type="datetime-local"
            value={endDateTime}
            onChange={(e) => setEndDateTime(e.target.value)}
            helperText="Local time (round closing time)"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Min Donation"
            type="number"
            min="1"
            value={minDonationUsdc}
            onChange={(e) => setMinDonationUsdc(e.target.value)}
            suffixElement="USDC"
            required
          />
          <Input
            label="Max Donation"
            type="number"
            min="1"
            value={maxDonationUsdc}
            onChange={(e) => setMaxDonationUsdc(e.target.value)}
            suffixElement="USDC"
            required
          />
          <Input
            label="Match Cap"
            type="number"
            min="1"
            max="100"
            value={maxMatchPercent}
            onChange={(e) => setMaxMatchPercent(e.target.value)}
            suffixElement="%"
            required
          />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSubmitting}
            isLoading={isSubmitting}
            className="text-xs font-bold py-2.5"
          >
            {isSubmitting ? "Deploying on Fuji..." : t.admin.createRoundBtn}
          </Button>
        </div>
      </form>
    </div>
  );
}

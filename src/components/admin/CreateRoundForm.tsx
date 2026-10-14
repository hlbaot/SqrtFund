"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { factoryAddress, usdcAddress } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { useToast } from "@/lib/context/toast";
import { useRound } from "@/hooks/useRound";
import { getContractErrorMessage } from "@/lib/errors";
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
  const { t } = useLocale();
  const { isConnected } = useAccount();
  const { addToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { refetch } = useRound();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !factoryAddress || !publicClient) {
      addToast({
        type: "error",
        title: "Factory not ready",
        description: "Please connect the factory owner wallet.",
      });
      return;
    }

    if (!startDateTime || !endDateTime) {
      addToast({
        type: "error",
        title: "Invalid schedule",
        description: "Please enter start and end dates.",
      });
      return;
    }

    const startTimestamp = BigInt(Math.floor(new Date(startDateTime).getTime() / 1000));
    const endTimestamp = BigInt(Math.floor(new Date(endDateTime).getTime() / 1000));

    if (endTimestamp <= startTimestamp) {
      addToast({
        type: "error",
        title: "Invalid schedule",
        description: "End time must be after start time.",
      });
      return;
    }

    const minDonation = BigInt(Math.round(parseFloat(minDonationUsdc) * 1_000_000));
    const maxDonation = BigInt(Math.round(parseFloat(maxDonationUsdc) * 1_000_000));
    const maxMatchBps = BigInt(Math.round(parseFloat(maxMatchPercent) * 100));

    setIsSubmitting(true);
    try {
      addToast({
        type: "pending",
        title: "Creating QF Round...",
        description: "Please confirm in your wallet.",
      });

      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: roundFactoryAbi,
        functionName: "createRound",
        args: [
          usdcAddress,
          startTimestamp,
          endTimestamp,
          minDonation,
          maxDonation,
          maxMatchBps,
        ],
      });

      addToast({
        type: "pending",
        title: "Confirming round deployment...",
        description: "Deploying QFRound smart contract on Avalanche Fuji.",
        txHash: hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("createRound transaction reverted.");
      }

      addToast({
        type: "success",
        title: "Round deployed successfully!",
        description: "New QFRound contract is live on Fuji.",
        txHash: hash,
      });

      refetch();
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Failed to create round",
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border border-line bg-surface p-6 space-y-4">
      <div>
        <h3 className="text-base font-bold text-foreground tracking-tight">
          {t.admin.createRoundTitle}
        </h3>
        <p className="text-xs text-muted">
          Deploy a new QFRound contract via the RoundFactory on Avalanche Fuji.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
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

"use client";

import { api, ApiError } from "@/lib/api";
import { useAccount, useSignMessage } from "wagmi";
import { organizerReviewMessage } from "@/lib/organizerReview";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrganizerApplication } from "@/lib/server/organizerApplications";

export type { OrganizerApplication };

export function useMyOrganizerApplication(walletAddress?: string) {
  const query = useQuery({
    queryKey: ["organizer-application", walletAddress?.toLowerCase()],
    queryFn: async (): Promise<OrganizerApplication | null> => {
      if (!walletAddress) return null;
      const { data: json } = await api.get("/api/organizer-applications", { params: { walletAddress } });
      if (!json.ok || !Array.isArray(json.applications) || json.applications.length === 0) {
        return null;
      }
      return json.applications[0];
    },
    enabled: Boolean(walletAddress),
    staleTime: 15_000,
  });

  const app = query.data ?? null;
  const isPending = app?.status === "pending";
  const isApproved = app?.status === "approved";
  const isRejected = app?.status === "rejected" && !app?.revocationReason;
  const isRevoked = app?.status === "revoked" || (app?.status === "rejected" && Boolean(app?.revocationReason));

  return {
    application: app,
    isPending,
    isApproved,
    isRejected,
    isRevoked,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useOrganizerApplicationsAdmin(statusFilter?: string, enabled = true) {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-organizer-applications", statusFilter || "all"],
    queryFn: async (): Promise<OrganizerApplication[]> => {
      const { data: json } = await api.get("/api/organizer-applications", {
        params: statusFilter && statusFilter !== "all" ? { status: statusFilter } : undefined,
      });
      if (!json.ok || !Array.isArray(json.applications)) {
        return [];
      }
      return json.applications;
    },
    enabled,
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      txHash,
      revocationReason,
    }: {
      id: string;
      status: "approved" | "rejected" | "revoked";
      txHash?: string;
      reviewedBy?: string;
      revocationReason?: string;
    }) => {
      if (!enabled || !address || chainId !== TARGET_CHAIN_ID) throw new Error("PLATFORM_OWNER_ONLY");
      const application = query.data?.find(app => app.id === id);
      if (!application) throw new Error("APPLICATION_CHANGED");
      const review = {
        id,
        status,
        txHash: txHash ?? null,
        revocationReason: revocationReason ?? null,
        reviewedBy: address,
        expectedUpdatedAt: application.updatedAt,
        issuedAt: Date.now(),
      };
      const signature = await signMessageAsync({ account: address, message: organizerReviewMessage(review, factoryAddress, TARGET_CHAIN_ID) });
      const { data } = await api.patch("/api/organizer-applications", { ...review, signature });
      if (!data.ok) throw new ApiError(data.error || "Failed to update application");
      return data.application as OrganizerApplication;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-organizer-applications"] });
      void queryClient.invalidateQueries({ queryKey: ["organizer-application"] });
    },
  });

  const applications = query.data ?? [];
  const pendingCount = applications.filter(a => a.status === "pending").length;

  return {
    applications,
    pendingCount,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    isUpdating: updateMutation.isPending,
    approveApplication: (id: string, txHash?: string, reviewedBy?: string) =>
      updateMutation.mutateAsync({ id, status: "approved", txHash, reviewedBy }),
    rejectApplication: (id: string, reviewedBy?: string, txHash?: string) =>
      updateMutation.mutateAsync({ id, status: "rejected", reviewedBy, txHash }),
    revokeApplication: (id: string, txHash: string, revocationReason: string, reviewedBy?: string) =>
      updateMutation.mutateAsync({ id, status: "revoked", txHash, revocationReason, reviewedBy }),
  };
}

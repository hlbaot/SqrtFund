"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrganizerApplication } from "@/lib/server/organizerApplications";

export type { OrganizerApplication };

export function useMyOrganizerApplication(walletAddress?: string) {
  const query = useQuery({
    queryKey: ["organizer-application", walletAddress?.toLowerCase()],
    queryFn: async (): Promise<OrganizerApplication | null> => {
      if (!walletAddress) return null;
      const res = await fetch(`/api/organizer-applications?walletAddress=${encodeURIComponent(walletAddress)}`);
      if (!res.ok) throw new Error("Failed to fetch application");
      const json = await res.json();
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
  const isRejected = app?.status === "rejected";

  return {
    application: app,
    isPending,
    isApproved,
    isRejected,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useOrganizerApplicationsAdmin(statusFilter?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-organizer-applications", statusFilter || "all"],
    queryFn: async (): Promise<OrganizerApplication[]> => {
      const url = statusFilter && statusFilter !== "all"
        ? `/api/organizer-applications?status=${encodeURIComponent(statusFilter)}`
        : `/api/organizer-applications`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch applications");
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.applications)) {
        return [];
      }
      return json.applications;
    },
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      txHash,
      reviewedBy,
    }: {
      id: string;
      status: "approved" | "rejected";
      txHash?: string;
      reviewedBy?: string;
    }) => {
      const res = await fetch("/api/organizer-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, txHash, reviewedBy }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update application");
      }
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
    rejectApplication: (id: string, reviewedBy?: string) =>
      updateMutation.mutateAsync({ id, status: "rejected", reviewedBy }),
  };
}

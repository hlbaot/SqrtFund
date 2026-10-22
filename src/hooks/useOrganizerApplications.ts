"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrganizerApplication } from "@/lib/server/organizerApplications";

export type { OrganizerApplication };

export function useMyOrganizerApplication(walletAddress?: string) {
  const query = useQuery({
    queryKey: ["organizer-application", walletAddress?.toLowerCase()],
    queryFn: async ({ signal }): Promise<OrganizerApplication | null> => {
      if (!walletAddress) return null;
      const res = await fetch(`/api/organizer-applications?walletAddress=${encodeURIComponent(walletAddress)}`, { cache: "no-store", signal });
      if (!res.ok) throw new Error("Failed to fetch application");
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.applications)) throw new Error("Invalid application response");
      return json.applications[0] ?? null;
    },
    enabled: Boolean(walletAddress),
    staleTime: 15_000,
    refetchInterval: 5000,
    refetchOnWindowFocus: "always",
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
    queryFn: async ({ signal }): Promise<OrganizerApplication[]> => {
      const url = statusFilter && statusFilter !== "all"
        ? `/api/organizer-applications?status=${encodeURIComponent(statusFilter)}`
        : `/api/organizer-applications`;
      const res = await fetch(url, { cache: "no-store", signal });
      if (!res.ok) throw new Error("Failed to fetch applications");
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.applications)) {
        throw new Error("Invalid application response");
      }
      return json.applications;
    },
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: "always",
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
    onSuccess: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ["admin-organizer-applications"] });
      // Cập nhật ngay mọi bộ lọc, rồi đối chiếu lại server; không chờ reload.
      for (const [key] of queryClient.getQueriesData({ queryKey: ["admin-organizer-applications"] })) {
        queryClient.setQueryData<OrganizerApplication[]>(key, previous => {
          if (!previous) return previous;
          const remaining = previous.filter(app => app.id !== updated.id);
          return key[1] === "all" || key[1] === updated.status ? [updated, ...remaining] : remaining;
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-organizer-applications"] }),
        queryClient.invalidateQueries({ queryKey: ["organizer-application"] }),
      ]);
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

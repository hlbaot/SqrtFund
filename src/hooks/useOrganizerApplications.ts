"use client";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { organizerStore } from "@/lib/store/organizerStore";
import { useVisiblePolling } from "./useVisiblePolling";
import { useOrganizerReadAccess } from "./useOrganizerReadAccess";

import { api, ApiError } from "@/lib/api";
import { useAccount, useSignMessage } from "wagmi";
import { organizerReviewMessage } from "@/lib/organizerReview";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrganizerApplication } from "@/lib/server/organizerApplications";

export type { OrganizerApplication };

export function useMyOrganizerApplication(walletAddress?: string) {
  const access = useOrganizerReadAccess();
  const { address, chainId, isConnected } = useAccount();
  const canRead = access.isAuthorized && isConnected && chainId === TARGET_CHAIN_ID
    && walletAddress?.toLowerCase() === address?.toLowerCase();
  const polling = useVisiblePolling();
  const query = useQuery({
    queryKey: ["organizer-application", TARGET_CHAIN_ID, factoryAddress, walletAddress?.toLowerCase(), access.cacheScope],
    queryFn: async ({ signal }): Promise<OrganizerApplication | null> => {
      if (!walletAddress) return null;
      const { data: json } = await api.get("/api/organizer-applications", { params: { walletAddress }, headers: access.headers, signal });
      if (!json.ok || !Array.isArray(json.applications) || json.applications.length === 0) {
        return null;
      }
      return json.applications[0];
    },
    enabled: Boolean(walletAddress && canRead),
    retry: false,
    staleTime: 15_000,
    refetchInterval: polling, refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (canRead && walletAddress && query.data !== undefined) organizerStore.getState().hydrate([{ id: walletAddress, application: query.data }], query.dataUpdatedAt);
  }, [canRead, walletAddress, query.data, query.dataUpdatedAt]);
  const mirrored = organizerStore(useShallow(state => walletAddress ? state.entities[walletAddress.toLowerCase()]?.application : undefined));
  const app = !canRead || query.isError ? null : mirrored === undefined ? query.data ?? null : mirrored;
  useEffect(() => {
    if (query.error instanceof ApiError && ["ORGANIZER_READ_AUTH_REQUIRED", "ORGANIZER_READ_AUTH_INVALID"].includes(query.error.code)) access.clearRejectedCredential();
  }, [query.error, access]);
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
    readAccess: access,
  };
}

export function useOrganizerApplicationsAdmin(statusFilter?: string, enabled = true) {
  const access = useOrganizerReadAccess();
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();

  const polling = useVisiblePolling();
  const query = useQuery({
    queryKey: ["admin-organizer-applications", TARGET_CHAIN_ID, factoryAddress, address?.toLowerCase(), statusFilter || "all", access.cacheScope],
    queryFn: async ({ signal }): Promise<OrganizerApplication[]> => {
      const { data: json } = await api.get("/api/organizer-applications", {
        params: statusFilter && statusFilter !== "all" ? { status: statusFilter } : undefined,
        headers: access.headers, signal,
      });
      if (!json.ok || !Array.isArray(json.applications)) {
        return [];
      }
      return json.applications;
    },
    enabled: enabled && access.isAuthorized,
    retry: false,
    staleTime: 10_000,
    refetchInterval: polling, refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (enabled && access.isAuthorized && query.data) organizerStore.getState().hydrate(query.data.map(application => ({ id: application.walletAddress, application })), query.dataUpdatedAt);
  }, [enabled, access.isAuthorized, query.data, query.dataUpdatedAt]);
  useEffect(() => {
    if (query.error instanceof ApiError && ["ORGANIZER_READ_AUTH_REQUIRED", "ORGANIZER_READ_AUTH_INVALID"].includes(query.error.code)) access.clearRejectedCredential();
  }, [query.error, access]);
  const mirroredApplications = organizerStore(useShallow(state => Object.values(state.entities).flatMap(wallet => wallet.application ? [wallet.application] : [])));
  const updateMutation = useMutation({
    onMutate: async (review: { id: string; status: "approved" | "rejected" | "revoked"; txHash?: string; reviewedBy?: string; revocationReason?: string }) => {
      await queryClient.cancelQueries({ predicate: q => ["organizer-application", "admin-organizer-applications"].includes(String(q.queryKey[0])) });
      const application = query.data?.find(app => app.id === review.id);
      if (!application) return undefined;
      const existing = organizerStore.getState().entities[application.walletAddress.toLowerCase()];
      return organizerStore.getState().upsert({ ...existing, id: application.walletAddress,
        application: { ...application, status: review.status, txHash: review.txHash ?? application.txHash,
          revocationReason: review.revocationReason ?? application.revocationReason } }, true);
    },
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
    onError: (_error, _variables, change) => { change?.rollback(); },
    onSuccess: (application, _variables, change) => {
      change?.commit();
      organizerStore.getState().hydrate([{ id: application.walletAddress, application }]);
      void queryClient.invalidateQueries({ queryKey: ["admin-organizer-applications"] });
      void queryClient.invalidateQueries({ queryKey: ["organizer-application"] });
    },
  });

  const applications = enabled && access.isAuthorized && !query.isError
    ? (query.data ?? []).map(app => mirroredApplications.find(mirrored => mirrored.id === app.id) ?? app)
      .filter(app => !statusFilter || statusFilter === "all" || app.status === statusFilter) : [];
  const pendingCount = applications.filter(a => a.status === "pending").length;

  return {
    applications,
    pendingCount,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    readAccess: access,
    isUpdating: updateMutation.isPending,
    approveApplication: (id: string, txHash?: string, reviewedBy?: string) =>
      updateMutation.mutateAsync({ id, status: "approved", txHash, reviewedBy }),
    rejectApplication: (id: string, reviewedBy?: string, txHash?: string) =>
      updateMutation.mutateAsync({ id, status: "rejected", reviewedBy, txHash }),
    revokeApplication: (id: string, txHash: string, revocationReason: string, reviewedBy?: string) =>
      updateMutation.mutateAsync({ id, status: "revoked", txHash, revocationReason, reviewedBy }),
  };
}

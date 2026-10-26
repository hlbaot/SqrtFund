"use client";
import { useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import {
  ORGANIZER_READ_TTL_MS,
  organizerReadMessage,
  type OrganizerReadPermit,
} from "@/lib/organizerReadAccess";
import {
  clearOrganizerReadAccess,
  organizerReadStore,
  syncOrganizerReadIdentity,
} from "@/lib/store/organizerReadStore";
import { useCurrentTimestamp } from "./useCurrentTimestamp";

export function useOrganizerReadAccess() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queries = useQueryClient();
  const credential = organizerReadStore((state) => state.credential);
  const isAuthorizing = organizerReadStore((state) => state.isAuthorizing);
  const error = organizerReadStore((state) => state.error);
  const nowSec = useCurrentTimestamp();
  const identity =
    isConnected && address && chainId === TARGET_CHAIN_ID
      ? `${chainId}:${address.toLowerCase()}`
      : undefined;
  useEffect(() => {
    if (organizerReadStore.getState().identity === identity) return;
    syncOrganizerReadIdentity(identity);
    void queries.cancelQueries({
      predicate: (q) =>
        ["organizer-application", "admin-organizer-applications"].includes(
          String(q.queryKey[0]),
        ),
    });
    queries.removeQueries({
      predicate: (q) =>
        ["organizer-application", "admin-organizer-applications"].includes(
          String(q.queryKey[0]),
        ),
    });
  }, [identity, queries]);
  useEffect(() => {
    if (credential) return;
    const predicate = (query: { queryKey: readonly unknown[] }) =>
      ["organizer-application", "admin-organizer-applications"].includes(
        String(query.queryKey[0]),
      );
    void queries.cancelQueries({ predicate });
    queries.removeQueries({ predicate });
  }, [credential, queries]);
  useEffect(() => {
    if (!credential) return;
    const timer = setTimeout(
      () => {
        if (organizerReadStore.getState().credential === credential)
          clearOrganizerReadAccess(identity);
      },
      Math.max(0, credential.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [credential, identity]);

  const isAuthorized = Boolean(
    identity &&
      credential?.identity === identity &&
      nowSec > 0 &&
      credential.expiresAt > nowSec * 1000,
  );
  const authorize = async () => {
    if (!identity || !address || organizerReadStore.getState().isAuthorizing)
      return;
    syncOrganizerReadIdentity(identity);
    const generation = organizerReadStore.getState().generation;
    organizerReadStore.setState({ isAuthorizing: true, error: undefined });
    try {
      const issuedAt = Date.now();
      const nonce = Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      const permit: OrganizerReadPermit = {
        walletAddress: address,
        origin: window.location.origin,
        factory: factoryAddress,
        chainId: TARGET_CHAIN_ID,
        issuedAt,
        expiresAt: issuedAt + ORGANIZER_READ_TTL_MS,
        nonce,
      };
      const signature = await signMessageAsync({
        account: address,
        message: organizerReadMessage(permit),
      });
      // A signature returned after logout/account change must not restore private access.
      if (
        organizerReadStore.getState().identity !== identity ||
        organizerReadStore.getState().generation !== generation
      )
        return;
      const token = btoa(JSON.stringify({ ...permit, signature }));
      organizerReadStore.setState({
        credential: { identity, token, expiresAt: permit.expiresAt, nonce },
        isAuthorizing: false,
      });
      void queries.invalidateQueries({
        predicate: (q) =>
          ["organizer-application", "admin-organizer-applications"].includes(
            String(q.queryKey[0]),
          ),
      });
    } catch {
      if (
        organizerReadStore.getState().identity === identity &&
        organizerReadStore.getState().generation === generation
      )
        organizerReadStore.setState({
          isAuthorizing: false,
          error: "ORGANIZER_READ_SIGN_FAILED",
        });
    }
  };
  return {
    isAuthorized,
    needsAuth: Boolean(isConnected && address && !isAuthorized),
    canSign: Boolean(identity),
    isAuthorizing,
    error,
    authorize,
    headers: isAuthorized
      ? { Authorization: `Bearer ${credential!.token}` }
      : undefined,
    cacheScope: isAuthorized ? credential!.nonce : undefined,
    clearRejectedCredential: () => {
      if (credential && organizerReadStore.getState().credential === credential)
        clearOrganizerReadAccess(identity);
    },
  };
}

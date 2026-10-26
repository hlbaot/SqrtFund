"use client";
import { useSignMessage } from "wagmi";
import { factoryAddress } from "@/lib/contracts/addresses";
import { createEmailWalletPermit, emailWalletMessage, type EmailWalletProof } from "@/lib/emailWalletProof";
import { api, ApiError } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { normalizeContactEmail } from "@/lib/organizerContact";

export function useOrganizerEmailOtp(wallet: string | undefined, email: string) {
  const { signMessageAsync } = useSignMessage();
  const walletProof = useRef<EmailWalletProof | undefined>(undefined);
  const now = useCurrentTimestamp() * 1000;
  const [challenge, setChallenge] = useState<{ id: string; identity: string; resendAt: number; expiresAt?: number }>();
  const [proof, setProof] = useState<{ token: string; expiresAt: number; identity: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const submitting = useRef(false);
  const identity = `${wallet?.toLowerCase()}:${normalizeContactEmail(email)}`;
  const invalidateCredential = useCallback(() => {
    generation.current++;
    walletProof.current = undefined;
  }, []);
  useEffect(() => {
    invalidateCredential();
    submitting.current = false;
    walletProof.current = undefined;
    setBusy(false);
    setChallenge(undefined); setProof(undefined); setCode(""); setError(undefined);
    return invalidateCredential;
  }, [identity, invalidateCredential]);
  const currentChallenge = challenge?.identity === identity ? challenge : undefined;
  const expiresIn = currentChallenge?.expiresAt ? Math.max(0, Math.ceil((currentChallenge.expiresAt - now) / 1000)) : 0;
  const expired = Boolean(currentChallenge?.id && currentChallenge.expiresAt && expiresIn === 0);
  const verified = proof?.identity === identity && proof.expiresAt > now;
  function reset() {
    walletProof.current = undefined;
    generation.current++;
    submitting.current = false;
    setChallenge(undefined); setProof(undefined); setCode(""); setError(undefined); setBusy(false);
  }
  async function act(action: "request" | "verify") {
    if (submitting.current) return;
    if (action === "verify" && (!currentChallenge?.id || !/^\d{6}$/.test(code))) { setError("INVALID_REQUEST"); return; }
    if (action === "verify" && expired) { setError("OTP_EXPIRED"); return; }
    submitting.current = true; setBusy(true); setError(undefined);
    const run = generation.current;
    try {
      if (!wallet) throw new Error("WALLET_PROOF_REQUIRED");
      let credential = walletProof.current;
      const permit = createEmailWalletPermit("organizer", email, wallet, factoryAddress);
      if (!credential || credential.email !== permit.email || credential.wallet !== permit.wallet || credential.expiresAt <= Date.now()) {
        credential = { ...permit, signature: await signMessageAsync({ account: wallet as `0x${string}`, message: emailWalletMessage(permit) }) };
        if (run !== generation.current) return;
        walletProof.current = credential;
      }
      const { data } = await api.post("/api/organizer-applications/email", {
        walletProof: credential, action, walletAddress: wallet, contactEmail: email, requestId: currentChallenge?.id, otp: code,
      });
      if (run !== generation.current) return;
      if (!data.ok) throw new ApiError(data.code || "SERVICE_UNAVAILABLE", data.retryAfter);
      if (action === "request") {
        setChallenge({ id: data.requestId, identity, expiresAt: Date.parse(data.expiresAt), resendAt: Date.now() + data.resendAfter * 1000 });
        setProof(undefined); setCode("");
      } else setProof({ token: data.emailVerificationToken, expiresAt: data.expiresAt, identity });
    } catch (error) {
      if (run === generation.current) {
        if (action === "request" && error instanceof ApiError && typeof error.retryAfter === "number") {
          const resendAt = Date.now() + error.retryAfter * 1000;
          setChallenge(previous => ({ id: previous?.identity === identity ? previous.id : "", identity,
            expiresAt: previous?.identity === identity ? previous.expiresAt : undefined, resendAt }));
        }
        setError(error instanceof Error ? error.message : "SERVICE_UNAVAILABLE");
      }
    } finally {
      if (run === generation.current) { submitting.current = false; setBusy(false); }
    }
  }
  return {
    code, setCode, busy, error, reset, expiresIn, expired, verified: Boolean(verified),
    token: verified ? proof?.token : undefined,
    hasChallenge: Boolean(currentChallenge?.id),
    resendIn: currentChallenge ? Math.max(0, Math.ceil((currentChallenge.resendAt - now) / 1000)) : 0,
    requestOtp: () => act("request"), verifyOtp: () => act("verify"),
  };
}

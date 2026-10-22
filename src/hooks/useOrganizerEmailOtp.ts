"use client";
import { useRef, useState } from "react";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { normalizeContactEmail } from "@/lib/organizerContact";

export function useOrganizerEmailOtp(wallet: string | undefined, email: string) {
  const now = useCurrentTimestamp() * 1000;
  const [challenge, setChallenge] = useState<{ id: string; identity: string; resendAt: number; expiresAt?: number }>();
  const [proof, setProof] = useState<{ token: string; expiresAt: number; identity: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const submitting = useRef(false);
  const identity = `${wallet?.toLowerCase()}:${normalizeContactEmail(email)}`;
  const currentChallenge = challenge?.identity === identity ? challenge : undefined;
  const expiresIn = currentChallenge?.expiresAt ? Math.max(0, Math.ceil((currentChallenge.expiresAt - now) / 1000)) : 0;
  const expired = Boolean(currentChallenge?.id && currentChallenge.expiresAt && expiresIn === 0);
  const verified = proof?.identity === identity && proof.expiresAt > now;
  function reset() {
    generation.current++;
    submitting.current = false;
    setChallenge(undefined); setProof(undefined); setCode(""); setError(undefined); setBusy(false);
  }
  async function act(action: "request" | "verify") {
    if (submitting.current) return;
    if (action === "verify" && expired) { setError("OTP_EXPIRED"); return; }
    submitting.current = true; setBusy(true); setError(undefined);
    const run = generation.current;
    try {
      const response = await fetch("/api/organizer-applications/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, walletAddress: wallet, contactEmail: email, requestId: currentChallenge?.id, otp: code }),
      });
      const data = await response.json();
      if (run !== generation.current) return;
      if (!response.ok || !data.ok) {
        if (action === "request" && typeof data.retryAfter === "number") setChallenge(previous => ({ id: previous?.id ?? "", identity, expiresAt: previous?.expiresAt, resendAt: Date.now() + data.retryAfter * 1000 }));
        throw new Error(data.code || "SERVICE_UNAVAILABLE");
      }
      if (action === "request") {
        setChallenge({ id: data.requestId, identity, expiresAt: Date.parse(data.expiresAt), resendAt: Date.now() + data.resendAfter * 1000 });
        setProof(undefined); setCode("");
      } else setProof({ token: data.emailVerificationToken, expiresAt: data.expiresAt, identity });
    } catch (error) {
      if (run === generation.current) setError(error instanceof Error ? error.message : "SERVICE_UNAVAILABLE");
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

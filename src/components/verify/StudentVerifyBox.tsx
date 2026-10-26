"use client";
import { api, ApiError } from "@/lib/api";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAccount, useSignMessage, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { useStudentVerificationEligibility } from "@/hooks/useStudentVerificationEligibility";
import { useStudentStatus } from "@/hooks/useStudentStatus";
import { useLocale } from "@/lib/context/locale";
import { useTxFlow } from "@/hooks/useTxFlow";
import { txToast, type TransactionFlow } from "@/lib/txToast";
import { studentRegistryAbi } from "@/lib/contracts/abis";
import { createEmailWalletPermit, emailWalletMessage, type EmailWalletProof } from "@/lib/emailWalletProof";
import { studentRegistryAddress } from "@/lib/contracts/addresses";
import { isAllowedEmail, maskEmail, type EmailDomainPolicy } from "@/lib/verify/domain";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

// Read the clock in event handlers and timer callbacks, outside render.
const eventTime = () => Date.now();

type CodeRequest = { requestId: string; expiresAt: string; resendAfter: number };
type Attestation = { registryAddress: Address; chainId: number; emailHash: Hex; expiry: string; signature: Hex };
async function post<T>(path: string, body: unknown): Promise<T> {
  const { data } = await api.post<T>(`/api/verify/${path}`, body);
  return data;
}
export function StudentVerifyBox({ showVerified = false }: { showVerified?: boolean }) {
  const { address, isConnected, chainId } = useAccount();
  const { canShowStudentIdentity } = useStudentVerificationEligibility();
  if (!isConnected || !address || !canShowStudentIdentity) return null;
  return <VerificationSession key={`${address}:${chainId}`} address={address} chainId={chainId} showVerified={showVerified} />;
}
function VerificationSession({ address, chainId, showVerified }: { address: Address; chainId?: number; showVerified: boolean }) {
  const { locale, t } = useLocale();
  const vi = locale === "vi";
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: 43113 });
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const walletProof = useRef<EmailWalletProof | undefined>(undefined);
  const { writeContractAsync } = useWriteContract();
  const beginFlow = useTxFlow();
  const { isStudent, isConfigured, isLoading, refetch } = useStudentStatus();
  const { data: config, isError: configError, error: domainConfigError } = useQuery({ queryKey: ["verification-domains"], queryFn: async () => {
    const { data } = await api.get<EmailDomainPolicy>("/api/verify/request-otp", {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
    return data;
  }, staleTime: 60_000 });
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [request, setRequest] = useState<CodeRequest>();
  const [attestation, setAttestation] = useState<Attestation>();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const domainHintId = useId();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const busyRef = useRef(false);
  const activeFlow = useRef<TransactionFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(eventTime()), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  const close = useCallback(() => {
    activeFlow.current?.cancel();
    busyRef.current = false;
    setBusy(false); setOpen(false);
  }, [setBusy, setOpen]);
  const left = request ? Math.max(0, Math.ceil((Date.parse(request.expiresAt) - now) / 1000)) : 0;
  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expiredRequest = useRef<string | null>(null);
  useEffect(() => {
    if (request && now > 0 && left === 0 && expiredRequest.current !== request.requestId) {
      expiredRequest.current = request.requestId;
      txToast.error("student-code-expired", t.verification.title, t.verification.emailErrors.OTP_EXPIRED);
    }
  }, [request, now, left, t]);
  useEffect(() => {
    if (configError) txToast.error("student-domain-config", t.verification.title, t.verification.emailErrors.CONFIG_MISSING + (domainConfigError instanceof ApiError && domainConfigError.missing ? ` (${domainConfigError.missing.join(", ")})` : ""));
  }, [configError, domainConfigError, t]);
  const invalidDomain = Boolean(email && config && !isAllowedEmail(email, config.allowedDomains, config.blockedDomains));
  const label = (en: string, vn: string) => vi ? vn : en;
  function showError(err: unknown) {
    const messages = t.verification.emailErrors;
    let code: keyof typeof messages = "TRANSACTION_FAILED";
    let attempts = "";
    if (err instanceof ApiError) {
      code = err.code in messages ? err.code as keyof typeof messages : "SERVICE_UNAVAILABLE";
      if (err.attemptsLeft !== undefined) attempts = ` (${err.attemptsLeft} ${t.verification.attemptsLeft})`;
      if (err.missing?.length) attempts += ` (${err.missing.filter(name => /^[A-Z0-9_]+$/.test(name)).join(", ")})`;
      if (err.retryAfter) setResendAt(eventTime() + err.retryAfter * 1000);
    } else if (err instanceof Error && err.message.includes("VerificationExpired")) {
      setAttestation(undefined);
      code = "SIGNATURE_EXPIRED";
    } else if (err instanceof Error && /reject|denied|4001/i.test(err.message)) {
      code = "WALLET_REJECTED";
    }
    const message = code === "INVALID_DOMAIN" && config?.mode === "open-edu"
      ? t.verification.openDomainError : messages[code];
    txToast.error("student-verification-error", t.verification.title, message + attempts);
  }
  async function sendCode(resend = false) {
    if (busyRef.current || resendLeft > 0) return;
    const target = (resend ? sentEmail : email).trim().toLowerCase();
    if (!config || !isAllowedEmail(target, config.allowedDomains, config.blockedDomains)) { showError(new ApiError("INVALID_DOMAIN")); return; }
    const flow = beginFlow("email-verification");
    activeFlow.current = flow;
    busyRef.current = true; setBusy(true);
    let resume: Attestation | undefined;
    try {
      flow.toast.pending("student-email", t.verification.title, label("Sign to prove wallet ownership…", "Ký để chứng minh quyền sở hữu ví…"));
      const permit = createEmailWalletPermit("student", target, address, studentRegistryAddress);
      const credential = { ...permit, signature: await flow.wait(() => signMessageAsync({ account: address, message: emailWalletMessage(permit) })) };
      if (!mounted.current || flow.cancelled) return;
      walletProof.current = credential;
      const result = await flow.wait(() => post<CodeRequest | (Attestation & { code: "ALREADY_VERIFIED" })>("request-otp", { email: target, address, walletProof: credential }));
      if (!mounted.current) return;
      if ("code" in result && result.code === "ALREADY_VERIFIED") {
        setAttestation(result); setSentEmail(target); setOpen(true); resume = result;
        txToast.info("student-email-existing", t.verification.title, t.verification.emailErrors.ALREADY_VERIFIED);
      } else {
      setRequest(result as CodeRequest); setSentEmail(target); setAttestation(undefined); setDigits(Array(6).fill(""));
      setResendAt(eventTime() + (result as CodeRequest).resendAfter * 1000); setNow(eventTime()); setOpen(true);
      // Modal may already be mounted on resend.
      requestAnimationFrame(() => inputs.current[0]?.focus());
      }
    } catch (err) { if (!flow.cancelled && mounted.current) showError(err); }
    finally { flow.finish(); if (mounted.current && activeFlow.current === flow) { busyRef.current = false; setBusy(false); } }
    if (resume && mounted.current) await confirm("", resume);
  }
  async function confirm(code: string, saved?: Attestation) {
    if (busyRef.current || (!request && !saved) || !publicClient) return;
    const flow = beginFlow("email-verification");
    activeFlow.current = flow;
    busyRef.current = true; setBusy(true);
    try {
      flow.toast.pending("student-email", t.verification.title, label("Checking code…", "Đang kiểm tra mã…"));
      const proof = saved ?? await flow.wait(() => post<Attestation>("confirm", { requestId: request!.requestId, otp: code, walletProof: walletProof.current }));
      if (!mounted.current) return;
      if (!isConfigured || proof.chainId !== 43113 || proof.registryAddress.toLowerCase() !== studentRegistryAddress.toLowerCase())
        throw new ApiError("REGISTRY_CHANGED");
      setAttestation(proof);
      if (BigInt(proof.expiry) <= BigInt(Math.floor(eventTime() / 1000))) { setAttestation(undefined); throw new ApiError("SIGNATURE_EXPIRED"); }
      flow.toast.pending("student-email", t.verification.title, label("Confirm the transaction in your wallet…", "Xác nhận giao dịch trong ví…"));
      const hash = await flow.wait(() => writeContractAsync({ address: studentRegistryAddress, abi: studentRegistryAbi, functionName: "verifyStudent",
        args: [proof.emailHash, BigInt(proof.expiry), proof.signature], chainId: 43113, account: address }));
      flow.toast.pending("student-email", label("Verifying student", "Đang xác thực sinh viên"), undefined, hash);
      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      flow.toast.success("student-email", label("Student verified", "Đã xác thực sinh viên"), undefined, hash);
      setOpen(false);
      await flow.wait(() => Promise.all([refetch(), queryClient.invalidateQueries()]));
    } catch (err) {
      if (!flow.cancelled) flow.toast.dismiss("student-email");
      if (!flow.cancelled && mounted.current) { showError(err); setDigits(Array(6).fill("")); inputs.current[0]?.focus(); }
    } finally { flow.finish(); if (mounted.current && activeFlow.current === flow) { busyRef.current = false; setBusy(false); } }
  }
  function updateDigits(next: string[]) {
    setDigits(next);
    if (next.every(d => /^\d$/.test(d))) void confirm(next.join(""));
  }
  if (isStudent) return showVerified ? <section className="space-y-2 rounded-sm border border-money/40 bg-surface p-5">
    <h2 className="font-bold text-money">{label("Student verified", "Đã xác thực Student")}</h2>
    <p className="text-sm text-muted">{label("Your wallet is verified for every round using the shared StudentRegistry. No repeat email verification needed.", "Ví của bạn đã được xác thực dùng chung cho các round sử dụng StudentRegistry. Không cần xác thực email lại.")}</p>
  </section> : null;
  if (isLoading) return <p role="status" className="p-4 text-sm text-muted">{label("Checking student identity…", "Đang kiểm tra trạng thái sinh viên…")}</p>;
  return <section className="space-y-3 rounded-sm border border-line bg-surface p-4" aria-label={label("Student verification", "Xác thực sinh viên")}>
    <h2 className="font-bold">{label("Verify with your university email", "Xác thực bằng email trường")}</h2>
    <p className="text-sm text-muted">{label("Sign with your wallet before receiving a code. Verify once to use your Student identity across rounds.", "Ký bằng ví trước khi nhận mã. Xác thực một lần để dùng quyền Student cho các round.")}</p>
    {chainId !== 43113 ? <Button isLoading={switching} onClick={async () => { try { await switchChainAsync({ chainId: 43113 }); } catch (err) { showError(err); } }}>{label("Switch to Avalanche Fuji", "Chuyển sang Avalanche Fuji")}</Button> : <>
      <form noValidate className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void sendCode(); }}>
        <label className="min-w-0 flex-1 text-sm">{label("University email", "Email trường")}
          <input type="email" value={email} maxLength={254} autoComplete="email" required disabled={busy}
            onChange={event => { setEmail(event.target.value); }} aria-invalid={invalidDomain}
            aria-describedby={domainHintId} className="mt-1 block w-full rounded-sm border border-line bg-bg p-2" placeholder="student@university.edu.vn" />
        </label>
        <Button type="submit" className="self-end" disabled={!config || resendLeft > 0} isLoading={busy}>{label("Send code", "Gửi mã")}{resendLeft > 0 ? ` (${resendLeft}s)` : ""}</Button>
      </form>
      <p id={domainHintId} className={`text-xs ${invalidDomain ? "text-primary" : "text-muted"}`}>
        {config ? config.mode === "open-edu" ? t.verification.openDomainHint : `${label("Accepted: ", "Chấp nhận: ")}${config.allowedDomains.join(", ") + label(" and subdomains", " và subdomain")}` : configError ? "" : label("Loading accepted domains…", "Đang tải domain được chấp nhận…")}
      </p>
      {request && <button className="text-sm underline" onClick={() => setOpen(true)}>{label("Enter code / retry transaction", "Nhập mã / thử lại giao dịch")}</button>}
    </>}
    <Dialog isOpen={open && chainId === 43113} onClose={close} title={label("Enter your verification code", "Nhập mã xác thực")}
      description={sentEmail ? `${label("Code sent to", "Mã đã gửi đến")} ${maskEmail(sentEmail)}` : undefined}>
      <div className="space-y-4">
        {!attestation && <>
        <div className="flex justify-center gap-2" onPaste={event => {
          const pasted = event.clipboardData.getData("text").trim();
          if (/^\d{6}$/.test(pasted)) { event.preventDefault(); if (!busy) { updateDigits(pasted.split("")); inputs.current[5]?.focus(); } }
        }}>
          {digits.map((digit, index) => <input key={index} ref={el => { inputs.current[index] = el; }} data-autofocus={index === 0 ? "true" : undefined}
            aria-label={`${label("Digit", "Chữ số")} ${index + 1}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? "one-time-code" : "off"}
            value={digit} disabled={busy || Boolean(attestation) || left === 0} className="h-12 w-9 min-w-0 rounded-sm border border-line bg-bg text-center font-mono text-xl sm:w-12"
            onChange={event => {
              const value = event.target.value.replace(/\D/g, "");
              if (value.length === 6) { updateDigits(value.split("")); inputs.current[5]?.focus(); return; }
              const next = [...digits]; next[index] = value.slice(-1); updateDigits(next);
              if (value && index < 5) inputs.current[index + 1]?.focus();
            }} onKeyDown={event => {
              if (event.key === "Backspace" && !digits[index] && index > 0) { event.preventDefault(); const next = [...digits]; next[index - 1] = ""; setDigits(next); inputs.current[index - 1]?.focus(); }
              if (event.key === "ArrowLeft") inputs.current[Math.max(0, index - 1)]?.focus();
              if (event.key === "ArrowRight") inputs.current[Math.min(5, index + 1)]?.focus();
            }} />)}
        </div>
        <p className="text-center text-sm text-muted">{`${label("Code expires in", "Mã hết hạn sau")} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p>
        </>}
        {attestation && <Button fullWidth isLoading={busy} onClick={() => void confirm("", attestation)}>{label("Retry wallet transaction", "Thử lại giao dịch trong ví")}</Button>}
        <div className="flex flex-wrap justify-between gap-2">
          {request && <Button variant="secondary" size="sm" disabled={busy || resendLeft > 0} onClick={() => void sendCode(true)}>{label("Resend", "Gửi lại")}{resendLeft > 0 ? ` (${resendLeft}s)` : ""}</Button>}
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setOpen(false); setRequest(undefined); setAttestation(undefined); }}>{label("Edit email", "Sửa email")}</Button>
        </div>
      </div>
    </Dialog>
  </section>;
}

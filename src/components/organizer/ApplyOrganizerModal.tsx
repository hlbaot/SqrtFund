"use client";

import { api, ApiError } from "@/lib/api";

import React, { useState } from "react";
import { isAddress } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { OtpInput } from "@/components/ui/OtpInput";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatusAlert } from "@/components/ui/StatusAlert";
import { useLocale } from "@/lib/context/locale";
import { useMyOrganizerApplication } from "@/hooks/useOrganizerApplications";
import { useOrganizerEmailOtp } from "@/hooks/useOrganizerEmailOtp";
import { validContactEmail } from "@/lib/organizerContact";
import { txToast } from "@/lib/txToast";
import {
  Building2,
  Mail,
  FileText,
  Wallet,
  Clock,
  ShieldOff,
  Eye,
  Send,
} from "lucide-react";

interface ApplyOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  isOrganizer?: boolean;
  isPlatformOwner?: boolean;
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function OrganizerApplicationForm({
  isOpen,
  onClose,
  walletAddress,
  isOrganizer = false,
  isPlatformOwner = false,
}: ApplyOrganizerModalProps) {
  const { t, locale } = useLocale();
  const c = t.applyOrganizer;
  const queryClient = useQueryClient();

  const {
    application,
    isPending,
    isRevoked,
    refetch,
  } = useMyOrganizerApplication(walletAddress);

  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ orgName?: string; email?: string; reason?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const emailOtp = useOrganizerEmailOtp(walletAddress, email);
  const vi = locale === "vi";
  const otpRequired = vi ? "Vui lòng xác thực email liên hệ bằng OTP trước khi gửi đơn." : "Verify your contact email with an OTP before submitting.";

  // Revocation detail state
  const [showRevocationDetails, setShowRevocationDetails] = useState(false);
  const [isReapplying, setIsReapplying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress || !isAddress(walletAddress)) {
      txToast.error("apply-org-error", c.validationWallet);
      return;
    }

    const errors: { orgName?: string; email?: string; reason?: string } = {};
    if (orgName.trim().length < 2 || orgName.trim().length > 120) {
      errors.orgName = c.validationOrg;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = c.validationEmail;
    }
    if (reason.trim().length < 5) {
      errors.reason = c.validationReason;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    if (!emailOtp.verified) {
      setFieldErrors({ email: otpRequired });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post("/api/organizer-applications", {
        walletAddress: walletAddress.trim(),
        organizationName: orgName.trim(),
        contactEmail: email.trim(),
        reason: reason.trim(),
        emailVerificationToken: emailOtp.token,
      });
      if (!data.ok) throw new ApiError(data.error || "Submission failed");

      setSubmitSuccess(true);
      txToast.success("apply-org-success", c.successTitle, c.successDesc, undefined, 4000);
      void queryClient.invalidateQueries({ queryKey: ["organizer-application"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-organizer-applications"] });
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_NOT_VERIFIED") {
          emailOtp.reset(); setFieldErrors({ email: otpRequired }); return;
        }
        if (err.code === "EMAIL_ALREADY_USED" || err.code === "WALLET_ALREADY_VERIFIED") {
          emailOtp.reset();
          setFieldErrors({ email: t.verification.emailErrors[err.code] });
          return;
        }
        if (err.code === "APPLICATION_ALREADY_PENDING") {
          txToast.info("apply-org-pending", c.alreadyPendingTitle, c.alreadyPendingDesc);
          void refetch();
          return;
        }
      }
      const msg = err instanceof Error ? err.message : "Failed to submit application";
      txToast.error("apply-org-error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={c.title} description={c.subtitle} className="max-w-xl">
      <div className="space-y-6 pt-2">
        {/* Connected wallet identification banner */}
        <div className="p-4 border border-line bg-surface/50 rounded-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5 font-medium">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              {c.walletLabel}
            </span>
            <span className="text-[11px] text-muted">{c.walletNotice}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm break-all font-semibold">
              {walletAddress || "--"}
            </span>
            {walletAddress && (
              <Badge variant="outline" className="shrink-0 text-[10px] text-primary border-primary/30">
                Fuji Testnet
              </Badge>
            )}
          </div>
        </div>

        {/* State 1: Already Organizer on-chain */}
        {isOrganizer ? (
          <div className="space-y-4 py-2">
            <StatusAlert
              tone="success"
              title={c.alreadyApprovedTitle}
            >
              {c.alreadyApprovedDesc}
            </StatusAlert>
            <div className="flex justify-end pt-2">
              <a
                href="/admin?tab=organizer"
                onClick={onClose}
                className="mono-label block bg-primary text-black px-4 py-2 text-sm font-semibold hover:bg-primary-hover transition-colors rounded-xs"
              >
                {c.goToOrganizerDashboard}
              </a>
            </div>
          </div>
        ) : isPlatformOwner ? (
          /* State 2: Already Platform Owner */
          <div className="space-y-4 py-2">
            <StatusAlert
              tone="info"
              title={t.admin.youAreOwner}
            >
              {t.wallet.platform_owner}
            </StatusAlert>
            <div className="flex justify-end pt-2">
              <a
                href="/admin?tab=platform"
                onClick={onClose}
                className="mono-label block bg-primary text-black px-4 py-2 text-sm font-semibold hover:bg-primary-hover transition-colors rounded-xs"
              >
                {t.nav.platformDashboard}
              </a>
            </div>
          </div>
        ) : isPending || submitSuccess ? (
          /* State 3: Pending review */
          <div className="space-y-4 py-2">
            <div className="p-4 border border-warning/40 bg-warning/5 rounded-xs space-y-3">
              <div className="flex items-center gap-2 text-warning font-semibold">
                <Clock className="h-4 w-4 animate-spin-slow" />
                <span>{c.alreadyPendingTitle}</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                {c.alreadyPendingDesc}
              </p>
              {application && (
                <div className="pt-2 text-xs border-t border-warning/20 space-y-1 font-mono text-muted">
                  <p><span className="text-foreground">{c.orgNameLabel}:</span> {application.organizationName}</p>
                  <p><span className="text-foreground">{c.emailLabel}:</span> {application.contactEmail}</p>
                  <p><span className="text-foreground">{c.submittedAt}</span> {new Date(application.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                {t.admin.closeBtn}
              </Button>
            </div>
          </div>
        ) : isRevoked && application && !isReapplying ? (
          /* State 3.5: Revoked - show revocation notice */
          <div className="space-y-4 py-2">
            <div className="p-4 border border-destructive/40 bg-destructive/5 rounded-xs space-y-3">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <ShieldOff className="h-4 w-4" />
                <span>{vi ? "Đã bị thu hồi quyền" : "Permission Revoked"}</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                {vi
                  ? "Quyền nhà tổ chức của bạn đã bị thu hồi bởi Platform Owner. Bạn có thể xem chi tiết hoặc gửi lại yêu cầu cấp quyền."
                  : "Your organizer permission has been revoked by the Platform Owner. You can view details or re-apply for permission."}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRevocationDetails(true)}
                  className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  {vi ? "Xem chi tiết" : "View Details"}
                </button>
              </div>
            </div>

            {/* Revocation Details Sub-dialog */}
            {showRevocationDetails && (
              <div className="p-4 border border-line bg-surface/50 rounded-xs space-y-4 animate-in fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted">
                    {vi ? "Lí do thu hồi" : "Revocation Reason"}
                  </label>
                  <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-xs text-sm leading-relaxed">
                    {application.revocationReason || (vi ? "Không có lí do cụ thể" : "No specific reason provided")}
                  </div>
                </div>
                <div className="text-xs text-muted font-mono space-y-1">
                  <p>
                    <span className="text-foreground">{vi ? "Tổ chức:" : "Organization:"}</span> {application.organizationName}
                  </p>
                  <p>
                    <span className="text-foreground">{vi ? "Địa chỉ ví:" : "Wallet:"}</span> {application.walletAddress}
                  </p>
                  {application.reviewedAt && (
                    <p>
                      <span className="text-foreground">{vi ? "Ngày thu hồi:" : "Revoked at:"}</span> {new Date(application.reviewedAt).toLocaleString(vi ? "vi-VN" : "en-US")}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
                  <Button type="button" variant="outline" onClick={() => setShowRevocationDetails(false)}>
                    {vi ? "Huỷ" : "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => { setShowRevocationDetails(false); setIsReapplying(true); }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {vi ? "Gửi yêu cầu lại" : "Re-apply"}
                  </Button>
                </div>
              </div>
            )}

            {!showRevocationDetails && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose}>
                  {t.admin.closeBtn}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsReapplying(true)}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {vi ? "Gửi yêu cầu lại" : "Re-apply"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* State 4: Standard application form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                {c.orgNameLabel} *
              </label>
              <Input
                data-autofocus
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder={c.orgNamePlaceholder}
                disabled={isSubmitting}
                error={fieldErrors.orgName}
                required
              />
              {fieldErrors.orgName && (
                <p className="text-xs text-destructive">{fieldErrors.orgName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                {c.emailLabel} *
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); emailOtp.reset(); setFieldErrors(previous => ({ ...previous, email: undefined })); }}
                placeholder={c.emailPlaceholder}
                disabled={isSubmitting || emailOtp.busy}
                error={fieldErrors.email}
                required
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
              <div className="space-y-3 pt-2">
                {emailOtp.verified ? <Badge variant="accent">{vi ? "Email đã xác thực" : "Email verified"}</Badge> : <>
                  <Button type="button" variant="outline" onClick={() => void emailOtp.requestOtp()}
                    disabled={isSubmitting || emailOtp.busy || emailOtp.resendIn > 0 || !validContactEmail(email) || !walletAddress}>
                    {emailOtp.busy ? (vi ? "Đang xử lý…" : "Processing…") : emailOtp.resendIn > 0 ? `${vi ? "Gửi lại sau" : "Resend in"} ${emailOtp.resendIn}s` : (vi ? "Gửi mã OTP" : "Send OTP")}
                  </Button>
                  {emailOtp.hasChallenge && <div className="space-y-3">
                    <OtpInput value={emailOtp.code} onChange={emailOtp.setCode} locale={locale}
                      disabled={isSubmitting || emailOtp.busy || emailOtp.expired} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p role="status" className={`text-xs font-mono ${emailOtp.expired ? "text-primary" : "text-muted"}`}>
                        {emailOtp.expired
                          ? (vi ? "Mã đã hết hạn. Hãy gửi lại mã mới." : "Code expired. Request a new code.")
                          : `${vi ? "Mã hết hạn sau" : "Code expires in"} ${Math.floor((emailOtp.expiresIn ?? 60) / 60)}:${String((emailOtp.expiresIn ?? 60) % 60).padStart(2, "0")}`}
                      </p>
                      <Button type="button" variant="outline" onClick={() => void emailOtp.verifyOtp().then(() => setFieldErrors(previous => ({ ...previous, email: undefined })))}
                        disabled={isSubmitting || emailOtp.busy || emailOtp.expired || !/^\d{6}$/.test(emailOtp.code)}>{vi ? "Xác thực mã" : "Verify code"}</Button>
                    </div>
                  </div>}
                </>}
                {emailOtp.error && <p role="alert" className="text-xs text-primary">{emailOtp.error in t.verification.emailErrors
                  ? t.verification.emailErrors[emailOtp.error as keyof typeof t.verification.emailErrors]
                  : (vi ? "Không thể xác thực email. Vui lòng thử lại." : "Email verification failed. Please retry.")}</p>}
                <p className="text-xs text-muted">{vi ? "Mã có hiệu lực 5 phút. Xác thực email không cấp quyền Organizer và không yêu cầu email trường." : "Codes expire after 5 minutes. Email verification does not grant Organizer access; a university email is not required."}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                {c.reasonLabel} *
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={c.reasonPlaceholder}
                disabled={isSubmitting}
                rows={4}
                className="w-full bg-surface border border-line p-3 text-sm focus:outline-hidden focus:border-primary transition-colors resize-none placeholder:text-muted/60"
                required
              />
              {fieldErrors.reason && (
                <p className="text-xs text-destructive">{fieldErrors.reason}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-line">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                {t.common.cancel}
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || emailOtp.busy || !walletAddress || !emailOtp.verified}>
                {isSubmitting ? c.submitting : c.submitBtn}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}

export function ApplyOrganizerModal(props: ApplyOrganizerModalProps) {
  // Đổi ví sẽ bỏ toàn bộ OTP, kết quả xác thực và trạng thái đơn của ví trước.
  return <OrganizerApplicationForm key={props.walletAddress?.toLowerCase() ?? "disconnected"} {...props} />;
}

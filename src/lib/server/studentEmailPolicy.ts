import "server-only";
import { emailDomainPolicy, isAllowedEmail } from "@/lib/verify/domain";
import { VerificationError } from "@/lib/verify/errors";

/** Áp chính sách tuyển sinh hiện tại ở cả bước yêu cầu OTP và cấp attestation. */
export function requireEligibleStudentEmail(email: string): void {
  const allowed = process.env.ALLOWED_EMAIL_DOMAINS;
  const blocked = process.env.BLOCKED_EMAIL_DOMAINS;
  if (emailDomainPolicy(allowed, blocked).mode === "unconfigured") {
    throw new VerificationError("STUDENT_DOMAIN_POLICY_UNCONFIGURED", 503);
  }
  if (!isAllowedEmail(email, allowed, blocked)) {
    throw new VerificationError("INVALID_DOMAIN", 400);
  }
}

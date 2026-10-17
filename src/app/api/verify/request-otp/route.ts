import { randomUUID } from "node:crypto";
import { isAddress, keccak256, toBytes } from "viem";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { emailDomainPolicy, emailDomain, isAllowedEmail, normalizeEmail } from "@/lib/verify/domain";
import { forwardedIp, generateOtp, hashOtp, hashValue } from "@/lib/verify/otp";
import { reserveOtp } from "@/lib/verify/rateLimit";
import { sendOtp } from "@/lib/verify/mailer";
import { validateRegistry, signVerification } from "@/lib/verify/signer";
import { verificationConfig } from "@/lib/verify/config";
import { VerificationError, databaseError, logServerError, type ErrorStage } from "@/lib/verify/errors";
import { failure, json, readBody } from "@/lib/verify/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  return json(emailDomainPolicy(process.env.ALLOWED_EMAIL_DOMAINS, process.env.BLOCKED_EMAIL_DOMAINS));
}
export async function POST(request: Request) {
  let stage: ErrorStage = "validate";
  try {
    let body: Record<string, unknown>;
    try { body = await readBody(request); } catch { return failure("INVALID_REQUEST"); }
    if (typeof body.email !== "string" || typeof body.address !== "string" || !isAddress(body.address)) return failure("INVALID_REQUEST");
    verificationConfig(true);
    // Validate the raw address too, so normalization cannot conceal malformed aliases.
    const deliveryEmail = body.email.trim().toLowerCase();
    const email = normalizeEmail(deliveryEmail);
    if (!isAllowedEmail(deliveryEmail, process.env.ALLOWED_EMAIL_DOMAINS, process.env.BLOCKED_EMAIL_DOMAINS)) return failure("INVALID_DOMAIN");
    const address = body.address.toLowerCase();
    stage = "registry"; const registry = (await validateRegistry()).toLowerCase();
    const db = supabaseAdmin(); const emailHash = keccak256(toBytes(email));
    stage = "insert";
    const { data: owner, error: ownerError } = await db.from("verifications").select("address").eq("email_hash", emailHash).maybeSingle();
    if (ownerError) throw databaseError(ownerError);
    if (owner && owner.address !== address) return failure("EMAIL_ALREADY_USED", 409);
    const { error: cleanupError } = await db.from("otp_requests").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if (cleanupError) throw databaseError(cleanupError);
    const id = randomUUID(), otp = generateOtp();
    stage = "rateLimit";
    const reservation = await reserveOtp(db, { id, email_hash: emailHash, email_domain: emailDomain(email)!, address,
      registry_address: registry, ip_hash: hashValue(forwardedIp(request.headers), "ip"), otp_hash: hashOtp(id, otp) });
    if (reservation.status === "RATE_LIMITED") return failure("RATE_LIMITED", 429, { retryAfter: reservation.retryAfter ?? 60 });
    if (["EMAIL_ALREADY_USED", "WALLET_ALREADY_VERIFIED"].includes(reservation.status)) return failure(reservation.status, 409);
    if (reservation.status === "ALREADY_VERIFIED") {
      // The persisted OTP-verified binding authorizes only this same wallet/email.
      // A signature is useful only to msg.sender = that wallet; no new mail is sent.
      stage = "registry";
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const signature = await signVerification(body.address, emailHash, expiry);
      return json({ code: "ALREADY_VERIFIED", registryAddress: registry, chainId: 43113, emailHash, expiry: expiry.toString(), signature });
    }
    if (reservation.status !== "OK" || !reservation.expiresAt) throw new Error("Reservation unavailable");
    stage = "mail";
    try { await sendOtp(deliveryEmail, otp); }
    catch (error) {
      logServerError("mail", error);
      const { error: deletionError } = await db.from("otp_requests").delete().eq("id", id);
      if (deletionError) logServerError("insert", deletionError);
      if (error instanceof VerificationError) return failure(error.code, error.status, { missing: error.missing });
      return failure("EMAIL_SEND_FAILED", 502);
    }
    return json({ requestId: id, expiresAt: reservation.expiresAt, resendAfter: 60 });
  } catch (error) {
    logServerError(stage, error);
    return error instanceof VerificationError ? failure(error.code, error.status, error.missing ? { missing: error.missing } : {}) : failure("SERVICE_UNAVAILABLE", 503);
  }
}

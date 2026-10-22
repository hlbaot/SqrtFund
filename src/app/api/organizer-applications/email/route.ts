import { setOtpExpiry } from "@/lib/verify/expiry";
import { randomUUID } from "node:crypto";
import { isAddress } from "viem";
import { normalizeContactEmail, validContactEmail } from "@/lib/organizerContact";
import { emailIdentityHash } from "@/lib/emailIdentity";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { issueOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { forwardedIp, generateOtp, hashOtp, hashValue, consumeError } from "@/lib/verify/otp";
import { mailConfig, requireConfig } from "@/lib/verify/config";
import { sendOtp } from "@/lib/verify/mailer";
import { readBody, json, failure } from "@/lib/verify/http";
import { databaseError, VerificationError, logServerError } from "@/lib/verify/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try { body = await readBody(request); } catch { return failure("INVALID_REQUEST"); }
    const { walletAddress, contactEmail, action } = body;
    if (typeof walletAddress !== "string" || !isAddress(walletAddress) || !validContactEmail(contactEmail)
      || (action !== "request" && action !== "verify")) return failure("INVALID_REQUEST");
    requireConfig(["OTP_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const wallet = walletAddress.toLowerCase(), email = normalizeContactEmail(contactEmail);
    const emailHash = hashValue(`organizer-contact:${email}`, "otp");
    const db = supabaseAdmin();
    if (action === "request") {
      await ensureEmailWallet(emailIdentityHash(email), wallet, false, db);
      mailConfig();
      const id = randomUUID(), otp = generateOtp();
      const { data, error } = await db.rpc("reserve_organizer_contact_otp", {
        p_id: id, p_wallet: wallet, p_email_hash: emailHash,
        p_ip_hash: hashValue(`organizer-contact:${forwardedIp(request.headers)}`, "ip"), p_otp_hash: hashOtp(`organizer:${id}`, otp),
      });
      if (error) throw databaseError(error);
      if (data?.status === "RATE_LIMITED") return failure("RATE_LIMITED", 429, { retryAfter: data.retryAfter });
      if (data?.status !== "OK") throw new Error("OTP reservation unavailable");
      const expiresAt = await setOtpExpiry(db, "organizer_contact_otps", id);
      try { await sendOtp(email, otp, "organizer"); }
      catch (error) {
        logServerError("mail", error);
        // Giữ lịch sử hạn mức ngay cả khi SMTP lỗi; mã không được dùng tiếp.
        await db.from("organizer_contact_otps").update({ used: true }).eq("id", id);
        return failure("EMAIL_SEND_FAILED", 502);
      }
      return json({ ok: true, requestId: id, expiresAt, resendAfter: 60 });
    }
    if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.requestId)
      || typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)) return failure("INVALID_REQUEST");
    const { data, error } = await db.rpc("consume_organizer_contact_otp", {
      p_id: body.requestId, p_wallet: wallet, p_email_hash: emailHash, p_otp_hash: hashOtp(`organizer:${body.requestId}`, body.otp),
    });
    if (error) throw databaseError(error);
    const rejected = consumeError(data);
    if (rejected) return failure(rejected.code, 400, rejected.attemptsLeft === undefined ? {} : { attemptsLeft: rejected.attemptsLeft });
    await ensureEmailWallet(emailIdentityHash(email), wallet, true, db);
    return json({ ok: true, ...issueOrganizerEmailProof(email, wallet) });
  } catch (error) {
    logServerError("validate", error);
    return error instanceof VerificationError ? failure(error.code, error.status) : failure("SERVICE_UNAVAILABLE", 503);
  }
}

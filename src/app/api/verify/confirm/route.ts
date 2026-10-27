import { requireEligibleStudentEmail } from "@/lib/server/studentEmailPolicy";
import { authorizeEmailWallet } from "@/lib/server/emailWalletAuthorization";
import { isAddress, type Address, type Hex } from "viem";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { consumeError, hashOtp, type ConsumeResult } from "@/lib/verify/otp";
import { signVerification, validateRegistry } from "@/lib/verify/signer";
import { verificationConfig } from "@/lib/verify/config";
import { VerificationError, databaseError, logServerError, type ErrorStage } from "@/lib/verify/errors";
import { failure, json, readBody } from "@/lib/verify/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await readBody(request); } catch { return failure("INVALID_REQUEST"); }
  if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId) ||
    typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)) return failure("INVALID_REQUEST");
  let stage: ErrorStage = "validate";
  try {
    verificationConfig();
    stage = "insert";
    const db = supabaseAdmin();
    const { data: row, error } = await db.from("otp_requests").select("address,registry_address,email_hash,email_domain,email")
      .eq("id", body.requestId).maybeSingle();
    if (error) throw databaseError(error);
    if (!row || typeof row.email !== "string") return failure("OTP_EXPIRED");
    if (!isAddress(row.address) || !isAddress(row.registry_address) || !/^0x[0-9a-f]{64}$/.test(row.email_hash))
      throw new Error("Invalid verification record");
    requireEligibleStudentEmail(row.email);
    await authorizeEmailWallet(request, body.walletProof, row.email, row.address, "student");
    stage = "registry";
    let registry: Address;
    try {
      registry = await validateRegistry();
      if (registry.toLowerCase() !== row.registry_address.toLowerCase()) throw new VerificationError("REGISTRY_CHANGED", 409);
    } catch (error) {
      logServerError("registry", error);
      if (error instanceof VerificationError) return failure(error.code, error.status, error.missing ? { missing: error.missing } : {});
      return failure("SERVICE_UNAVAILABLE", 503);
    }
    stage = "validate";
    // Database khoá dòng OTP, kiểm tra hạn/mã/số lần thử rồi ghi used_at nếu đúng.
    // Hai request nhập cùng mã không thể cùng thành công: request sau thấy đã dùng.
    // consume_otp được định nghĩa trong migration 0001_verification.sql.
    const { data: consumed, error: consumeFailure } = await db.rpc("consume_otp", {
      p_id: body.requestId, p_otp_hash: hashOtp(body.requestId, body.otp),
    });
    if (consumeFailure) throw databaseError(consumeFailure);
    if (!consumed) throw new Error("Database unavailable");
    const rejected = consumeError(consumed as ConsumeResult);
    if (rejected) return failure(rejected.code, 400, rejected.attemptsLeft === undefined ? {} : { attemptsLeft: rejected.attemptsLeft });
    stage = "registry";
    // OTP đã bị vô hiệu ở bước consume. 3.600 giây dưới đây là hạn chữ ký
    // để người dùng ký giao dịch trong ví, KHÔNG phải hạn dùng OTP.
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
    // Persist uniqueness before releasing the signature, even for concurrent confirms.
    stage = "insert";
    const identity = await ensureEmailWallet(row.email, row.address, true, db);
    if (identity !== row.email_hash) throw new VerificationError("SERVICE_UNAVAILABLE", 503);
    const signature = await signVerification(row.address as Address, row.email_hash as Hex, expiry);
    const { error: insertError } = await db.from("verifications").upsert({ ...row, verified_at: new Date().toISOString() },
      { onConflict: "email_hash", ignoreDuplicates: true });
    if (insertError) {
      if (insertError.code === "23505") return failure("EMAIL_ALREADY_USED", 409);
      throw databaseError(insertError);
    }
    // An ignored duplicate may be owned by another wallet; never release that signature.
    const { data: owner, error: ownerError } = await db.from("verifications").select("address")
      .eq("email_hash", row.email_hash).single();
    if (ownerError) throw databaseError(ownerError);
    if (!owner) throw new Error("Database unavailable");
    if (owner.address !== row.address) return failure("EMAIL_ALREADY_USED", 409);
    return json({ registryAddress: registry, chainId: 43113, emailHash: row.email_hash, expiry: expiry.toString(), signature });
  } catch (error) {
    logServerError(stage, error);
    // OTP đã dùng vẫn hết hiệu lực; liên kết email–ví đã xác minh được giữ lại.
    // Nếu ký lỗi, người dùng có thể gửi mã mới và thử lại với cùng cặp email–ví.
    return error instanceof VerificationError ? failure(error.code, error.status, error.missing ? { missing: error.missing } : {}) : failure("SERVICE_UNAVAILABLE", 503);
  }
}

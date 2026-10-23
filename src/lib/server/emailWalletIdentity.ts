import "server-only";
import { randomBytes } from "node:crypto";
import type { Hex } from "viem";
import { legacyEmailIdentityHash } from "@/lib/emailIdentity";
import { normalizeEmail } from "@/lib/verify/domain";
import { supabaseAdmin, type AdminDb } from "@/lib/verify/supabaseAdmin";
import { databaseError, VerificationError } from "@/lib/verify/errors";

/** Email trực tiếp làm khoá; chỉ liên kết ví sau khi chứng minh OTP/token hợp lệ. */
export async function ensureEmailWallet(email: string, walletAddress: string, claim = false, db: AdminDb = supabaseAdmin()): Promise<Hex> {
  const canonical = normalizeEmail(email);
  const { data, error } = await db.rpc("enforce_plain_email_wallet", {
    p_email: canonical, p_wallet_address: walletAddress.toLowerCase(), p_claim: claim,
    p_new_identity: `0x${randomBytes(32).toString("hex")}`,
    // Chỉ tìm lại dữ liệu cũ; email mới dùng ID ngẫu nhiên, không lưu hash email.
    p_legacy_hash: legacyEmailIdentityHash(canonical),
  });
  if (error) throw databaseError(error);
  if (data?.status === "EMAIL_ALREADY_USED" || data?.status === "WALLET_ALREADY_VERIFIED") throw new VerificationError(data.status, 409);
  if (data?.status !== "OK" || typeof data.verificationId !== "string" || !/^0x[0-9a-f]{64}$/.test(data.verificationId)) throw new VerificationError("SERVICE_UNAVAILABLE", 503);
  return data.verificationId as Hex;
}

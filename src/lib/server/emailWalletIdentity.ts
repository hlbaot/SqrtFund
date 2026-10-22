import "server-only";
import { emailIdentityHash } from "@/lib/emailIdentity";
import { supabaseAdmin, type AdminDb } from "@/lib/verify/supabaseAdmin";
import { databaseError, VerificationError } from "@/lib/verify/errors";

/** Chỉ claim sau khi đã chứng minh quyền truy cập email qua OTP/chữ ký token. */
export async function ensureEmailWallet(emailHash: string, walletAddress: string, claim = false, db: AdminDb = supabaseAdmin()): Promise<void> {
  const wallet = walletAddress.toLowerCase();
  // Đơn đã xác thực trước migration vẫn giữ quyền sở hữu email. Đọc theo trang
  // để không bỏ sót dữ liệu khi Supabase giới hạn 1.000 dòng mỗi truy vấn.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("organizer_applications").select("contact_email,wallet_address")
      .not("email_verified_at", "is", null).order("id").range(offset, offset + 999);
    if (error) throw databaseError(error);
    for (const row of data ?? []) {
      if (emailIdentityHash(row.contact_email) === emailHash && row.wallet_address.toLowerCase() !== wallet) {
        throw new VerificationError("EMAIL_ALREADY_USED", 409);
      }
    }
    if (!data || data.length < 1000) break;
  }
  // Unique key trong DB phân xử cả hai yêu cầu xác thực chạy đồng thời.
  const { data, error } = await db.rpc("enforce_email_wallet", { p_email_hash: emailHash, p_wallet_address: wallet, p_claim: claim });
  if (error) throw databaseError(error);
  if (data?.status === "EMAIL_ALREADY_USED") throw new VerificationError("EMAIL_ALREADY_USED", 409);
  if (data?.status !== "OK") throw new VerificationError("SERVICE_UNAVAILABLE", 503);
}

import type { AdminDb } from "./supabaseAdmin";
import { databaseError } from "./errors";

// Hạn nhập OTP: 5 phút × 60.000 mili giây. Không phải thời gian chờ gửi lại (60 giây).
export const OTP_VALIDITY_MS = 5 * 60_000;

/** Ghi hạn OTP vào database trước khi gửi mail, kể cả DB còn default cũ 10 phút. */
export async function setOtpExpiry(db: AdminDb, table: "otp_requests" | "organizer_contact_otps", id: string) {
  // Backend tính mốc hết hạn; trình duyệt chỉ nhận mốc này để hiển thị đếm ngược.
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS).toISOString();
  const { error } = await db.from(table).update({ expires_at: expiresAt }).eq("id", id);
  // Không gửi OTP nếu chưa lưu được hạn dùng; tránh mã trên mail lệch trạng thái DB.
  if (error) throw databaseError(error);
  return expiresAt;
}

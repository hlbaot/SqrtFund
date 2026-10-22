import type { AdminDb } from "./supabaseAdmin";
import { databaseError } from "./errors";

export const OTP_VALIDITY_MS = 60_000;

/** Set the database deadline before delivery, including on databases with older 10-minute defaults. */
export async function setOtpExpiry(db: AdminDb, table: "otp_requests" | "organizer_contact_otps", id: string) {
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS).toISOString();
  const { error } = await db.from(table).update({ expires_at: expiresAt }).eq("id", id);
  if (error) throw databaseError(error);
  return expiresAt;
}

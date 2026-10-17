import "server-only";
import { databaseError } from "./errors";
import type { AdminDb } from "./supabaseAdmin";
export type Reservation = { status: "OK" | "RATE_LIMITED" | "EMAIL_ALREADY_USED" | "WALLET_ALREADY_VERIFIED" | "ALREADY_VERIFIED"; expiresAt?: string; retryAfter?: number };
export async function reserveOtp(db: AdminDb, values: {
  id: string; email_hash: string; email_domain: string; address: string;
  registry_address: string; ip_hash: string; otp_hash: string;
}): Promise<Reservation> {
  const args = Object.fromEntries(Object.entries(values).map(([k, v]) => [`p_${k}`, v]));
  const { data, error } = await db.rpc("reserve_otp", args);
  if (error) throw databaseError(error);
  if (!data) throw new Error("Reservation unavailable");
  return data as Reservation;
}

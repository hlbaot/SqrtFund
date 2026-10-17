import "server-only";
import { requireConfig } from "./config";
import { createClient } from "@supabase/supabase-js";
export function supabaseAdmin() {
  requireConfig(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Verification configuration unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export type AdminDb = ReturnType<typeof supabaseAdmin>;

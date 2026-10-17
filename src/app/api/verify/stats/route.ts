import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { VerificationError, databaseError, logServerError } from "@/lib/verify/errors";
import { failure, json } from "@/lib/verify/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().rpc("verification_stats");
    if (error) throw databaseError(error);
    if (!data) throw new Error("Database unavailable");
    return json(data);
  } catch (error) {
    logServerError("insert", error);
    return error instanceof VerificationError ? failure(error.code, error.status, error.missing ? { missing: error.missing } : {}) : failure("SERVICE_UNAVAILABLE", 503);
  }
}

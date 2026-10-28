import { NextResponse } from "next/server";
import {
  parseProfileChange,
  profileScope,
  type ProfilePermit,
} from "@/lib/projectProfile";
import {
  authorizeProfile,
  readProfileProject,
} from "@/lib/server/projectProfileAuthorization";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { VerificationError } from "@/lib/verify/errors";
export const runtime = "nodejs";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function fail(e: unknown) {
  return json(
    { code: e instanceof VerificationError ? e.code : "PROFILE_UNAVAILABLE" },
    e instanceof VerificationError ? e.status : 503,
  );
}
export async function GET(request: Request) {
  let scope;
  try {
    const q = new URL(request.url).searchParams;
    scope = profileScope(q.get("round"), q.get("projectId"));
  } catch {
    return json({ code: "INVALID_PROFILE" }, 400);
  }
  try {
    await readProfileProject(scope.round, scope.projectId);
    const { data, error } = await supabaseAdmin()
      .from("project_profiles")
      .select("profile,reports,revision,updated_at")
      .eq("chain_id", 43113)
      .eq("round_address", scope.round)
      .eq("project_id", scope.projectId)
      .maybeSingle();
    if (error) throw error;
    return json({ document: data });
  } catch (e) {
    return fail(e);
  }
}
export async function PUT(request: Request) {
  let body: Record<string, unknown>, change;
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return json({ code: "PROFILE_AUTH_INVALID" }, 401);
    const reader = request.body?.getReader();
    if (!reader) return json({ code: "INVALID_PROFILE" }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        length += r.value.length;
        if (length > 65536) {
          await reader.cancel();
          return json({ code: "INVALID_PROFILE" }, 413);
        }
        chunks.push(r.value);
      }
    } finally {
      reader.releaseLock();
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    change = parseProfileChange(body);
  } catch {
    return json({ code: "INVALID_PROFILE" }, 400);
  }
  try {
    const owner = await authorizeProfile(
      request,
      change,
      body.permit as ProfilePermit,
      body.signature,
    );
    const { data, error } = await supabaseAdmin().rpc("save_project_profile", {
      p_round: change.round,
      p_project: change.projectId,
      p_owner: owner,
      p_revision: change.revision,
      p_profile: change.profile,
      p_report: change.report,
    });
    if (error || !data) throw error ?? Error("No acknowledgment");
    if (data.status === "CONFLICT")
      return json({ code: "PROFILE_CONFLICT" }, 409);
    if (
      data.status !== "OK" ||
      !data.document ||
      data.document.revision !== change.revision + 1
    )
      throw Error("Invalid acknowledgment");
    return json({ document: data.document });
  } catch (e) {
    return fail(e);
  }
}

import { NextResponse } from "next/server";
import { governanceRound, parseGovernance, type GovernanceChange } from "@/lib/roundGovernance";
import { authorizeGovernance, governanceChain } from "@/lib/server/roundGovernance";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { VerificationError } from "@/lib/verify/errors";
import type { ProfilePermit } from "@/lib/projectProfile";
export const runtime = "nodejs";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function fail(e: unknown) { return json({ code: e instanceof VerificationError ? e.code : "GOVERNANCE_UNAVAILABLE" }, e instanceof VerificationError ? e.status : 503); }
export async function GET(request: Request) {
  let round;
  try { round = governanceRound(new URL(request.url).searchParams.get("round")); } catch { return json({ code: "INVALID_GOVERNANCE" }, 400); }
  try {
    await governanceChain(round);
    const { data, error } = await supabaseAdmin().from("round_governance").select("id,kind,payload,owner_address,transaction_hash,created_at").eq("chain_id", 43113).eq("round_address", round).order("id");
    if (error) throw error;
    return json({ records: data });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  let body, change;
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return json({ code: "GOVERNANCE_AUTH_INVALID" }, 401);
    const reader = request.body?.getReader();
    if (!reader) throw Error("body");
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > 65536) { await reader.cancel(); return json({ code: "INVALID_GOVERNANCE" }, 413); } chunks.push(r.value); } } finally { reader.releaseLock(); }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8")); change = parseGovernance(body);
  } catch { return json({ code: "INVALID_GOVERNANCE" }, 400); }
  try {
    const owner = await authorizeGovernance(request, change, body.permit as ProfilePermit, body.signature, body.transactionHash);
    if (change.kind === "category") {
      const { data: policyRow, error: policyError } = await supabaseAdmin().from("round_governance").select("payload").eq("chain_id", 43113).eq("round_address", change.round).eq("entry_key", "policy").maybeSingle();
      if (policyError) throw policyError;
      const policy = policyRow?.payload as GovernanceChange | undefined;
      if (policy?.kind === "policy" && policy.policy.categories && !policy.policy.categories.includes(change.category)) return json({ code: "CATEGORY_NOT_ALLOWED" }, 409);
    }
    const row = { chain_id: 43113, round_address: change.round, kind: change.kind, entry_key: change.kind === "policy" ? "policy" : change.kind === "review" ? `review:${change.review.projectId}` : `category:${change.projectId}`, owner_address: owner, payload: change, transaction_hash: change.kind === "review" ? body.transactionHash.toLowerCase() : null };
    const { data, error } = await supabaseAdmin().from("round_governance").insert(row).select("id,kind,payload,owner_address,transaction_hash,created_at").single();
    if (error?.code === "23505") return json({ code: "GOVERNANCE_ALREADY_PUBLISHED" }, 409);
    if (error || !data) throw error ?? Error("Missing acknowledgment");
    return json({ record: data });
  } catch (e) { return fail(e); }
}

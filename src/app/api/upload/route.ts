import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeUpload } from "@/lib/server/uploadAuthorization";
import { MAX_UPLOAD_BYTES, imageMatchesMime } from "@/lib/uploadPermit";
import { validateUploadImage } from "@/lib/server/uploadImage";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { VerificationError } from "@/lib/verify/errors";
import { cloudinaryConfig } from "@/lib/server/cloudinaryConfig";
export const runtime = "nodejs";
const MAX_BODY = MAX_UPLOAD_BYTES + 64 * 1024;
/** Classify provider diagnostics without copying arbitrary text into server logs. */
function providerFailureReason(message: unknown): string {
  if (typeof message !== "string") return "NO_PROVIDER_ERROR_MESSAGE";
  if (/missing permissions/i.test(message) && /actions=\["create"\]/i.test(message)) return "MISSING_CREATE_PERMISSION";
  if (/cloud.{0,60}disabled/i.test(message)) return "CLOUD_DISABLED";
  if (/account.{0,60}(disabled|suspended|blocked)/i.test(message)) return "ACCOUNT_DISABLED";
  if (/api.?key.{0,60}disabled/i.test(message)) return "API_KEY_DISABLED";
  if (/invalid.{0,20}api.?key/i.test(message)) return "INVALID_API_KEY";
  if (/invalid.{0,20}signature/i.test(message)) return "INVALID_SIGNATURE";
  if (/upload.?preset/i.test(message)) return "UPLOAD_PRESET_RESTRICTION";
  if (/quota|rate.?limit|usage.?limit/i.test(message)) return "PROVIDER_LIMIT";
  if (/not allowed|forbidden|restricted|denied|permission/i.test(message)) return "UPLOAD_NOT_ALLOWED";
  return "UNCLASSIFIED_PROVIDER_ERROR";
}
function reply(error: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}
/** Bound chunked bodies too, before parsing multipart data. Never trust Content-Length alone. */
async function readForm(request: Request) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY))
    throw new VerificationError("UPLOAD_TOO_LARGE", 413);
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data;") ||
    !request.body
  )
    throw new VerificationError("UPLOAD_INVALID_FILE", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new VerificationError("UPLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new VerificationError("UPLOAD_INVALID_FILE", 400);
  }
}
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let stage = "origin";
  let providerStatus: number | undefined;
  let providerReason: string | undefined;
  let databaseCode: string | undefined;
  const configNames = new Set([
    "CLOUDINARY_URL", "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", "NEXT_PUBLIC_CHAIN_ID",
  ]);
  const fail = (code: string, status: number, retryAfter?: number, missing?: string[]) => {
    // Explicit fields only: never log request bodies, wallet signatures, credentials,
    // provider messages, raw exceptions or URLs (which can contain credentials).
    console.error("[project-image-upload]", {
      requestId, stage, code, status, elapsedMs: Date.now() - startedAt,
      ...(missing?.length ? { missingOrInvalid: missing.filter(name => configNames.has(name)) } : {}),
      ...(databaseCode ? { databaseCode } : {}),
      ...(providerStatus !== undefined ? { providerStatus } : {}),
      ...(providerReason ? { providerReason } : {}),
    });
    const response = reply(code, status, retryAfter);
    response.headers.set("X-Request-ID", requestId);
    return response;
  };
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return fail("UPLOAD_AUTH_INVALID", 401);
    stage = "authorization";
    const permit = await authorizeUpload(request);
    stage = "multipart";
    const form = await readForm(request);
    const files = form.getAll("file");
    const file = files[0];
    if (
      files.length !== 1 ||
      !(file instanceof File) ||
      file.size !== permit.size ||
      file.type !== permit.mime
    )
      return fail("UPLOAD_INVALID_FILE", 400);
    stage = "file-integrity";
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (
      !imageMatchesMime(bytes, file.type) ||
      crypto.createHash("sha256").update(bytes).digest("hex") !== permit.digest
    )
      return fail("UPLOAD_INVALID_FILE", 400);
    // Unsigned presets bypass this endpoint's authorization/quota; never use one here.
    stage = "cloudinary-config";
    const { cloudName, apiKey, secret } = cloudinaryConfig();
    stage = "quota";
    const { data, error } = await supabaseAdmin().rpc(
      "reserve_project_upload",
      {
        p_wallet: permit.wallet,
        p_nonce: permit.nonce,
        p_bytes: file.size,
      },
    );
    if (error || !data) {
      if (typeof error?.code === "string" && /^(?:PGRST\d{3}|[A-Z0-9]{5})$/.test(error.code)) databaseCode = error.code;
      return fail("UPLOAD_QUOTA_UNAVAILABLE", 503);
    }
    if (data.status === "REPLAY") return fail("UPLOAD_ALREADY_USED", 409);
    if (data.status === "RATE_LIMITED")
      return fail(
        "UPLOAD_QUOTA_EXCEEDED",
        429,
        Number(data.retryAfter) || 3600,
      );
    if (data.status !== "OK") return fail("UPLOAD_QUOTA_UNAVAILABLE", 503);
    // Charge expensive attempts before decoding. Replays/quota denials must not
    // repeatedly invoke the decoder; invalid content also burns this nonce/quota.
    stage = "image-decode";
    await validateUploadImage(bytes, file.type);
    // Reservation stays charged if decoding or Cloudinary fails. Never retry automatically.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", apiKey);
    body.append("timestamp", timestamp);
    body.append(
      "signature",
      crypto
        .createHash("sha1")
        .update(`timestamp=${timestamp}${secret}`)
        .digest("hex"),
    );
    stage = "cloudinary-upload";
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body, signal: AbortSignal.timeout(20_000) },
    );
    providerStatus = res.status;
    if (!res.ok) {
      const diagnostic = await res.json().catch(() => null);
      providerReason = providerFailureReason(diagnostic?.error?.message);
      return fail(providerReason === "MISSING_CREATE_PERMISSION" ? "UPLOAD_PROVIDER_PERMISSION_DENIED" : "UPLOAD_PROVIDER_FAILED", 502);
    }
    stage = "cloudinary-response";
    const result = await res.json();
    if (
      typeof result.secure_url !== "string" ||
      !result.secure_url.startsWith("https://res.cloudinary.com/")
    )
      return fail("UPLOAD_PROVIDER_FAILED", 502);
    return NextResponse.json(
      { url: result.secure_url },
      { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
    );
  } catch (error) {
    return error instanceof VerificationError
      ? fail(error.code, error.status, undefined, error.missing)
      : fail("UPLOAD_UNAVAILABLE", 503);
  }
}

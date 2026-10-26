import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeUpload } from "@/lib/server/uploadAuthorization";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadPermit";
import { validateUploadImage } from "@/lib/server/uploadImage";
import { supabaseAdmin } from "@/lib/verify/supabaseAdmin";
import { VerificationError } from "@/lib/verify/errors";
export const runtime = "nodejs";
const MAX_BODY = MAX_UPLOAD_BYTES + 64 * 1024;
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
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return reply("UPLOAD_AUTH_INVALID", 401);
    const permit = await authorizeUpload(request);
    const form = await readForm(request);
    const files = form.getAll("file");
    const file = files[0];
    if (
      files.length !== 1 ||
      !(file instanceof File) ||
      file.size !== permit.size ||
      file.type !== permit.mime
    )
      return reply("UPLOAD_INVALID_FILE", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (
      crypto.createHash("sha256").update(bytes).digest("hex") !== permit.digest
    )
      return reply("UPLOAD_INVALID_FILE", 400);
    await validateUploadImage(bytes, file.type);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    // Unsigned presets bypass this endpoint's authorization/quota; never use one here.
    if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !secret)
      return reply("UPLOAD_CONFIG_MISSING", 503);
    const { data, error } = await supabaseAdmin().rpc(
      "reserve_project_upload",
      {
        p_wallet: permit.wallet,
        p_nonce: permit.nonce,
        p_bytes: file.size,
      },
    );
    if (error || !data) return reply("UPLOAD_QUOTA_UNAVAILABLE", 503);
    if (data.status === "REPLAY") return reply("UPLOAD_ALREADY_USED", 409);
    if (data.status === "RATE_LIMITED")
      return reply(
        "UPLOAD_QUOTA_EXCEEDED",
        429,
        Number(data.retryAfter) || 3600,
      );
    if (data.status !== "OK") return reply("UPLOAD_QUOTA_UNAVAILABLE", 503);
    // Reservation is charged even if Cloudinary fails/timeouts. Never retry automatically.
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
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return reply("UPLOAD_PROVIDER_FAILED", 502);
    const result = await res.json();
    if (
      typeof result.secure_url !== "string" ||
      !result.secure_url.startsWith("https://res.cloudinary.com/")
    )
      return reply("UPLOAD_PROVIDER_FAILED", 502);
    return NextResponse.json(
      { url: result.secure_url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return error instanceof VerificationError
      ? reply(error.code, error.status)
      : reply("UPLOAD_UNAVAILABLE", 503);
  }
}

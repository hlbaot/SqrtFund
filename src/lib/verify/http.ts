import "server-only";
import { copy } from "@/lib/copy";
import { NextResponse } from "next/server";
export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
export function failure(code: string, status = 400, extra: Record<string, unknown> = {}) {
  const messages = copy.en.verification.emailErrors;
  const message = code in messages ? `${copy.vi.verification.emailErrors[code as keyof typeof messages]} / ${messages[code as keyof typeof messages]}`
    : "Không thể hoàn tất xác thực. / Unable to complete verification.";
  return json({ code, message, ...extra }, status,
    typeof extra.retryAfter === "number" ? { "Retry-After": String(extra.retryAfter) } : undefined);
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Invalid request");
  const raw = await request.text();
  if (raw.length > 4096) throw new Error("Invalid request");
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid request");
  return data;
}

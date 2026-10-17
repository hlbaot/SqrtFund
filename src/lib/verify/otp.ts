import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
export function generateOtp(): string { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function hashValue(value: string, purpose: "otp" | "ip", secret = process.env.OTP_SECRET): string {
  if (!secret || secret.length < 32) throw new Error("Verification configuration unavailable");
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}
// Bind a code to its request; a leaked hash cannot be transplanted across requests.
export function hashOtp(id: string, otp: string, secret?: string): string { return hashValue(`${id}:${otp}`, "otp", secret); }
export function equalHashes(a: string, b: string): boolean {
  return /^[0-9a-f]{64}$/.test(a) && /^[0-9a-f]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export function forwardedIp(headers: Pick<Headers, "get">): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first && isIP(first) ? first : "unknown";
}
export type ConsumeResult = { status: "OK" | "WRONG" | "EXPIRED" | "LOCKED"; attemptsLeft?: number };
export function consumeError(result: ConsumeResult): { code: string; attemptsLeft?: number } | null {
  switch (result.status) {
    case "OK": return null;
    case "WRONG": return { code: "OTP_WRONG", attemptsLeft: result.attemptsLeft };
    case "LOCKED": return { code: "OTP_LOCKED" };
    case "EXPIRED": return { code: "OTP_EXPIRED" };
    default: throw new Error("Invalid consume result");
  }
}

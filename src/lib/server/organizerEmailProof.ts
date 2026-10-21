import "server-only";
import { hashValue, equalHashes } from "@/lib/verify/otp";
import { normalizeContactEmail } from "@/lib/organizerContact";

const PURPOSE = "organizer-contact-email";
export function issueOrganizerEmailProof(email: string, wallet: string, now = Date.now()) {
  const expiresAt = now + 15 * 60_000;
  const payload = Buffer.from(JSON.stringify({ purpose: PURPOSE, email: normalizeContactEmail(email), wallet: wallet.toLowerCase(), expiresAt })).toString("base64url");
  return { emailVerificationToken: `${payload}.${hashValue(`${PURPOSE}:${payload}`, "otp")}`, expiresAt };
}
/** Backend tự xác minh chữ ký, email, ví và hạn dùng; không tin cờ từ UI. */
export function verifyOrganizerEmailProof(token: unknown, email: string, wallet: string, now = Date.now()): boolean {
  if (typeof token !== "string" || token.length > 2048) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!equalHashes(signature, hashValue(`${PURPOSE}:${payload}`, "otp"))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.purpose === PURPOSE && data.email === normalizeContactEmail(email) && data.wallet === wallet.toLowerCase()
      && Number.isSafeInteger(data.expiresAt) && data.expiresAt > now;
  } catch { return false; }
}

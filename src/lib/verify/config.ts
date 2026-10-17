import "server-only";
import { isAddress } from "viem";
import { VerificationError } from "./errors.ts";
export function requireConfig(names: string[]): void {
  const missing = names.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new VerificationError("CONFIG_MISSING", 503, { missing });
}
export function mailConfig(): void {
  requireConfig(["EMAIL_PROVIDER", "SMTP_FROM"]);
  if (process.env.EMAIL_PROVIDER === "smtp") {
    requireConfig(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]);
    const invalid: string[] = [];
    if (![465, 587, 2525].includes(Number(process.env.SMTP_PORT))) invalid.push("SMTP_PORT");
    if (process.env.SMTP_HOST === "smtp.gmail.com") {
      const from = process.env.SMTP_FROM!.match(/<([^<>]+)>\s*$/)?.[1] ?? process.env.SMTP_FROM!;
      if (from.trim().toLowerCase() !== process.env.SMTP_USER!.trim().toLowerCase()) invalid.push("SMTP_FROM");
      if (!/^[a-zA-Z0-9]{16}$/.test(process.env.SMTP_PASS!)) invalid.push("SMTP_PASS");
    }
    if (invalid.length) throw new VerificationError("CONFIG_MISSING", 503, { missing: invalid });
  } else if (process.env.EMAIL_PROVIDER === "resend") requireConfig(["RESEND_API_KEY"]);
  else throw new VerificationError("CONFIG_MISSING", 503, { missing: ["EMAIL_PROVIDER"] });
}
export function verificationConfig(withMail = false): void {
  requireConfig(["ATTESTER_PRIVATE_KEY", "OTP_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS"]);
  const invalid: string[] = [];
  if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.ATTESTER_PRIVATE_KEY!)) invalid.push("ATTESTER_PRIVATE_KEY");
  if (process.env.OTP_SECRET!.length < 32) invalid.push("OTP_SECRET");
  if (!isAddress(process.env.NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS!) || /^0x0{40}$/i.test(process.env.NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS!)) invalid.push("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS");
  if (invalid.length) throw new VerificationError("CONFIG_MISSING", 503, { missing: invalid });
  if (withMail) mailConfig();
}

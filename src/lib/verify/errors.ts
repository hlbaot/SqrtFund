import "server-only";
export type ErrorStage = "validate" | "registry" | "rateLimit" | "insert" | "mail";
export class VerificationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly missing?: string[];
  constructor(code: string, status = 503, options?: ErrorOptions & { missing?: string[] }) {
    super(code, options); this.name = "VerificationError"; this.code = code; this.status = status; this.missing = options?.missing;
  }
}
export function databaseError(error: unknown): VerificationError {
  const code = (error as { code?: string } | null)?.code;
  const schema = ["42P01", "42703", "42883", "42P10", "PGRST202", "PGRST204", "PGRST205"].includes(code ?? "");
  return new VerificationError(schema ? "DB_SCHEMA_MISMATCH" : "SERVICE_UNAVAILABLE", 503, { cause: error });
}
/** Log only approved diagnostic fields. Never payloads, stacks, email, OTP or secrets. */
export function logServerError(stage: ErrorStage, error: unknown): void {
  let root = error;
  for (let depth = 0; depth < 4 && root instanceof Error && root.cause; depth++) root = root.cause;
  const value = (root && typeof root === "object" ? root : {}) as { name?: unknown; code?: unknown; message?: unknown };
  const redact = (input: unknown, limit: number) => {
    let result = typeof input === "string" ? input : "";
    for (const name of ["ATTESTER_PRIVATE_KEY", "OTP_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "SMTP_PASS", "RESEND_API_KEY"]) {
      const secret = process.env[name]; if (secret) result = result.split(secret).join("[redacted]");
    }
    return result.replace(/https?:\/\/[^\s)]+/gi, "[redacted URL]")
      .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[redacted email]")
      .replace(/\b\d{6}\b/g, "[redacted OTP]").slice(0, limit);
  };
  console.error({ stage, name: redact(value.name, 80) || "Error", code: redact(value.code, 80), message: redact(value.message || (root instanceof Error ? root.message : "Verification unavailable"), 300) });
}

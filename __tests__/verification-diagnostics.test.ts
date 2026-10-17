import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { logServerError } from "@/lib/verify/errors";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("retains diagnostics and causes without printing credentials, email, OTP or RPC credentials", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const secret = "fixture-secret-sentinel-not-a-real-credential";
  for (const name of ["ATTESTER_PRIVATE_KEY", "OTP_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "SMTP_PASS", "RESEND_API_KEY"]) vi.stubEnv(name, secret);
  logServerError("mail", new Error(`RPC https://rpc.invalid/private-token email student@hust.edu.vn code 012345 ${secret}`, {
    cause: { code: "RPC_FAILURE", message: `nested ${secret}` },
  }));
  const output = JSON.stringify(log.mock.calls);
  for (const value of [secret, "student@hust.edu.vn", "012345", "private-token"]) expect(output).not.toContain(value);
  expect(output).toContain("RPC_FAILURE"); expect(output).not.toContain("stack"); expect(output).toContain("[redacted");
});

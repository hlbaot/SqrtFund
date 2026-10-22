import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ readContract: vi.fn(), send: vi.fn(), reserve: vi.fn(), delete: vi.fn(), log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn().mockResolvedValue(undefined) }));
vi.mock("viem", async importOriginal => ({ ...await importOriginal<typeof import("viem")>(), createPublicClient: () => ({ readContract: f.readContract }) }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: () => ({
  select: () => { const query = { eq: () => query, maybeSingle: async () => ({ data: null, error: null }) }; return query; }, delete: f.delete,
}) }) }));
vi.mock("@/lib/verify/rateLimit", () => ({ reserveOtp: f.reserve }));
vi.mock("@/lib/verify/mailer", () => ({ sendOtp: f.send }));
import { BaseError, ContractFunctionExecutionError, ContractFunctionRevertedError, ContractFunctionZeroDataError } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { studentRegistryAbi } from "@/lib/contracts/abis";
import { POST } from "@/app/api/verify/request-otp/route";
import { validateRegistry } from "@/lib/verify/signer";
const registry = "0x2222222222222222222222222222222222222222";
const address = "0x1111111111111111111111111111111111111111";
const fixtureKey = `0x${"11".repeat(32)}` as const;
function request() { return new Request("https://sqrt.test/api/verify/request-otp", { method: "POST", body: JSON.stringify({ email: "a@hust.edu.vn", address }) }); }
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(f.log);
  vi.stubEnv("ATTESTER_PRIVATE_KEY", fixtureKey); vi.stubEnv("OTP_SECRET", "test-secret-used-only-in-tests-at-least-32-chars");
  vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", registry); vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", ""); vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "hust.edu.vn");

  vi.stubEnv("ATTESTER_PRIVATE_KEY", `0x${"11".repeat(32)}`);
  vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", registry);
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-role");
  vi.stubEnv("EMAIL_PROVIDER", "smtp"); vi.stubEnv("SMTP_HOST", "smtp.gmail.com"); vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "fixture@gmail.com"); vi.stubEnv("SMTP_FROM", "SqrtFund <fixture@gmail.com>"); vi.stubEnv("SMTP_PASS", "abcdefghijklmnop");
  vi.stubEnv("BLOCKED_EMAIL_DOMAINS", "");
  f.delete.mockReturnValue({ lt: async () => ({ error: null }) }); f.reserve.mockResolvedValue({ status: "OK", expiresAt: "2030-01-01T00:10:00Z" }); f.send.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function expectError(code: string, status: number) {
  const response = await POST(request()); expect(response.status).toBe(status);
  const body = await response.json(); expect(body.code).toBe(code); expect(body).not.toHaveProperty("signature");
  expect(f.send).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.delete).not.toHaveBeenCalled(); expect(f.log).toHaveBeenCalled();
}
describe("shared StudentRegistry validation", () => {
  it("maps an empty getter revert to REGISTRY_UNAVAILABLE", async () => {
    const cause = new ContractFunctionRevertedError({ abi: studentRegistryAbi, data: "0x", functionName: "attester" });
    f.readContract.mockRejectedValueOnce(new ContractFunctionExecutionError(cause, { abi: studentRegistryAbi, contractAddress: registry, functionName: "attester" })); await expectError("REGISTRY_UNAVAILABLE", 503);
  });
  it("maps empty getter return data to REGISTRY_UNAVAILABLE", async () => {
    f.readContract.mockRejectedValueOnce(new ContractFunctionZeroDataError({ functionName: "attester" })); await expectError("REGISTRY_UNAVAILABLE", 503);
  });
  it("returns CONFIG_MISSING when missing the single global target", async () => {
    vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", ""); await expectError("CONFIG_MISSING", 503); expect(f.readContract).not.toHaveBeenCalled();
  });
  it("returns REGISTRY_UNAVAILABLE for a different signer", async () => {
    f.readContract.mockResolvedValueOnce(address); await expectError("REGISTRY_UNAVAILABLE", 503);
  });
  it("sends OTP with no factory or rounds and reads only the registry attester", async () => {
    f.readContract.mockResolvedValueOnce(privateKeyToAccount(fixtureKey).address);
    const response = await POST(request()); expect(response.status).toBe(200); expect(f.send).toHaveBeenCalledOnce();
    expect(f.readContract).toHaveBeenCalledTimes(1); expect(f.readContract.mock.calls[0][0]).toMatchObject({ address: registry, functionName: "attester" });
  });
  it("ignores a client-supplied registry target and uses server configuration", async () => {
    f.readContract.mockResolvedValueOnce(privateKeyToAccount(fixtureKey).address);
    const response = await POST(new Request("https://sqrt.test/api/verify/request-otp", { method: "POST", body: JSON.stringify({ email: "a@hust.edu.vn", address, registryAddress: "invalid-client-registry" }) }));
    expect(response.status).toBe(200); expect(f.readContract).toHaveBeenCalledTimes(1);
  });
  it("preserves transport failures as REGISTRY_UNAVAILABLE", async () => {
    f.readContract.mockRejectedValueOnce(new BaseError("RPC unavailable")); await expectError("REGISTRY_UNAVAILABLE", 503);
  });
  it("does not misclassify a nonempty revert as unsupported", async () => {
    f.readContract.mockRejectedValueOnce(new ContractFunctionRevertedError({ abi: studentRegistryAbi, data: "0xdeadbeef", functionName: "attester" })); await expectError("REGISTRY_UNAVAILABLE", 503);
  });
  it("preserves missing backend key configuration as REGISTRY_UNAVAILABLE", async () => {
    f.readContract.mockResolvedValueOnce(address); vi.stubEnv("ATTESTER_PRIVATE_KEY", ""); await expectError("CONFIG_MISSING", 503);
  });
  it("compares the public attester case insensitively", async () => {
    f.readContract.mockResolvedValueOnce(privateKeyToAccount(fixtureKey).address.toLowerCase()); await expect(validateRegistry()).resolves.toBe(registry);
  });
});

import { afterEach, expect, it, vi } from "vitest";
import { keccak256, recoverTypedDataAddress, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
vi.mock("server-only", () => ({}));
import { signVerification, verificationTypes } from "@/lib/verify/signer";
afterEach(() => vi.unstubAllEnvs());
it("signs the global StudentRegistry domain independently of any round or factory", async () => {
  const key = `0x${"11".repeat(32)}` as const;
  vi.stubEnv("ATTESTER_PRIVATE_KEY", key);
  const student = "0x1111111111111111111111111111111111111111";
  const round = "0x2222222222222222222222222222222222222222";
  const emailHash = keccak256(toBytes("student@hust.edu.vn")); const expiry = 2_000_000_000n;
  vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", round);
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", "");
  const signature = await signVerification(student, emailHash, expiry);
  const signed = { domain: { name: "SqrtFundStudentRegistry", version: "1", chainId: 43113, verifyingContract: round }, types: verificationTypes,
    primaryType: "StudentVerification" as const, message: { student, emailHash, expiry }, signature } as const;
  expect(await recoverTypedDataAddress(signed)).toBe(privateKeyToAccount(key).address);
  expect(await recoverTypedDataAddress({ ...signed, domain: { ...signed.domain, chainId: 1 } })).not.toBe(privateKeyToAccount(key).address);
  expect(await recoverTypedDataAddress({ ...signed, domain: { ...signed.domain, name: "SqrtFund" } })).not.toBe(privateKeyToAccount(key).address);
  expect(await recoverTypedDataAddress({ ...signed, domain: { ...signed.domain, verifyingContract: student } })).not.toBe(privateKeyToAccount(key).address);
});

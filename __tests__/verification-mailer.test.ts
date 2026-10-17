import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport: f.create } }));
import { sendOtp } from "@/lib/verify/mailer";
beforeEach(() => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "587", SMTP_USER: "fixture@gmail.com", SMTP_FROM: "SqrtFund <fixture@gmail.com>", SMTP_PASS: "abcdefghijklmnop" })) vi.stubEnv(name, value);
  f.create.mockReturnValue({ sendMail: f.send }); f.send.mockResolvedValue({ accepted: ["student@hust.edu.vn"], rejected: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("uses STARTTLS, bounded timeouts and the branded multipart template", async () => {
  await sendOtp("student@hust.edu.vn", "012345");
  expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, requireTLS: true, logger: false, debug: false, connectionTimeout: 10000, socketTimeout: 15000 }));
  expect(f.send).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("012345"), html: expect.stringContaining("012345") }));
});
it.each(["wrong@gmail.com", "SqrtFund <wrong@gmail.com>"])("rejects a mismatched sender %s", async from => {
  vi.stubEnv("SMTP_FROM", from); await expect(sendOtp("student@hust.edu.vn", "012345")).rejects.toMatchObject({ code: "CONFIG_MISSING", missing: ["SMTP_FROM"] });
  expect(f.send).not.toHaveBeenCalled();
});
it("rejects an app password containing spaces", async () => {
  vi.stubEnv("SMTP_PASS", "abcd efgh ijkl mnop"); await expect(sendOtp("student@hust.edu.vn", "012345")).rejects.toMatchObject({ code: "CONFIG_MISSING" });
});
it("propagates SMTP rejection instead of reporting success", async () => {
  f.send.mockRejectedValue(new Error("SMTP rejected")); await expect(sendOtp("student@hust.edu.vn", "012345")).rejects.toThrow("SMTP rejected");
});

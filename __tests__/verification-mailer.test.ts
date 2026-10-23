import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), post: vi.fn() }));
vi.mock("axios", () => ({ default: { post: f.post } }));
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
it("sends contact-verification instructions without asking Organizer applicants to verify as students", async () => {
  await sendOtp("contact@gmail.com", "123456", "organizer");
  const message = f.send.mock.calls[0][0];
  expect(message.subject).toContain("Organizer");
  expect(message.text).toContain("không cấp quyền Organizer");
  expect(message.text).not.toContain("confirm the wallet transaction");
  expect(message.html).toContain("123456");
});

it("sends Resend email through Axios with a bounded request", async () => {
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "fixture-key");
  f.post.mockResolvedValue({ status: 200 });
  await sendOtp("student@hust.edu.vn", "123456");
  expect(f.post).toHaveBeenCalledWith("https://api.resend.com/emails",
    expect.objectContaining({ to: ["student@hust.edu.vn"], text: expect.stringContaining("123456") }),
    expect.objectContaining({ headers: { Authorization: "Bearer fixture-key" }, signal: expect.any(AbortSignal) }));
  expect(f.send).not.toHaveBeenCalled();
});
it("does not expose Axios request details when Resend fails", async () => {
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "fixture-key");
  f.post.mockRejectedValue(new Error("Request failed with sensitive provider details"));
  await expect(sendOtp("student@hust.edu.vn", "123456")).rejects.toThrow("Email delivery failed");
});

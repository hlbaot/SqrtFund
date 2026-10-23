import "server-only";
import axios from "axios";
import { mailConfig } from "./config.ts";
import nodemailer from "nodemailer";
import { buildVerificationEmail } from "./emailTemplate.ts";
export async function sendOtp(email: string, otp: string, purpose: "student" | "organizer" = "student"): Promise<void> {
  mailConfig();
  const from = process.env.SMTP_FROM;
  if (!from || !/^\d{6}$/.test(otp)) throw new Error("Mailer unavailable");
  const { subject, text, html } = buildVerificationEmail(otp, purpose);
  const provider = process.env.EMAIL_PROVIDER ?? "smtp";
  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) throw new Error("Mailer unavailable");
    try {
      await axios.post("https://api.resend.com/emails", { from, to: [email], subject, text, html }, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Avoid passing Axios request config (including credentials) to server logs.
      throw new Error("Email delivery failed");
    }
  } else if (provider === "smtp") {
    const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass } = process.env;
    const port = Number(process.env.SMTP_PORT ?? 587);
    if (!host || !user || !pass || ![465, 587, 2525].includes(port)) throw new Error("Mailer unavailable");
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, requireTLS: port !== 465,
      auth: { user, pass }, connectionTimeout: 10_000, socketTimeout: 15_000, logger: false, debug: false
    });
    const result = await transport.sendMail({ from, to: email, subject, text, html });
    if (!result.accepted.length || result.rejected.length) throw new Error("Email delivery failed");
  } else throw new Error("Mailer unavailable");
}

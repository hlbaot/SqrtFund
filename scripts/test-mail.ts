/** Real mailer smoke test; no Supabase writes and no OTP/email/secret logging.
 * node --conditions=react-server --env-file=.env.local --experimental-strip-types scripts/test-mail.ts <recipient>
 */
import { sendOtp } from "../src/lib/verify/mailer.ts";
import { generateOtp } from "../src/lib/verify/otp.ts";
import { logServerError } from "../src/lib/verify/errors.ts";
const recipient = process.argv[2];
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error("Usage: node --conditions=react-server --env-file=.env.local --experimental-strip-types scripts/test-mail.ts <recipient>");
  process.exitCode = 1;
} else {
  sendOtp(recipient, generateOtp()).then(() => {
    console.log("Test email accepted by provider. Check inbox/spam. This test code is not registered for account verification.");
  }).catch(error => { logServerError("mail", error); process.exitCode = 1; });
}

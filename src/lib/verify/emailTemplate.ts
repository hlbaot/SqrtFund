/** Self-contained email markup: inline styles/tables, no remote images or fonts. */
export function buildVerificationEmail(otp: string, purpose: "student" | "organizer" = "student"): { subject: string; text: string; html: string } {
  if (otp.length !== 6 || !/^\d{6}$/.test(otp)) throw new Error("Invalid verification code");
  if (purpose === "organizer") {
    const subject = "SqrtFund — Xác thực email liên hệ Organizer";
    const text = `Mã xác thực email liên hệ Organizer / Organizer contact email code: ${otp}\nCó hiệu lực trong 10 phút / Valid for 10 minutes.\nNhập mã trong đơn đăng ký Organizer. Xác thực email không cấp quyền Organizer; đơn vẫn cần Platform Owner duyệt.\nEnter the code in your Organizer application. Email verification does not grant Organizer access; Platform Owner approval is required.\nKhông chia sẻ mã. Nếu không yêu cầu mã, hãy bỏ qua email này.`;
    const html = `<html lang="vi"><body style="background:#0c0c12;color:#eeeeef;font-family:Arial,sans-serif;padding:32px"><h1>SqrtFund</h1><h2>Xác thực email liên hệ Organizer</h2><p>Organizer contact email verification</p><p style="font-size:32px;letter-spacing:6px">${otp}</p><p>Mã có hiệu lực trong 10 phút / Valid for 10 minutes.</p><p>Xác thực email không cấp quyền Organizer. Đơn đăng ký vẫn cần Platform Owner duyệt.</p><p>Email verification does not grant Organizer access. Your application requires Platform Owner approval.</p><p>Không chia sẻ mã. Nếu không yêu cầu mã, hãy bỏ qua email này.</p></body></html>`;
    return { subject, text, html };
  }
  const subject = "Mã xác thực SqrtFund / SqrtFund verification code";
  const text = `SQRTFUND — XÁC THỰC EMAIL TRƯỜNG / UNIVERSITY EMAIL VERIFICATION\n\nMã xác thực của bạn / Your verification code: ${otp}\nCó hiệu lực trong 10 phút / Valid for 10 minutes.\n\nQuay lại SqrtFund và nhập mã trong cửa sổ xác thực email. Sau khi mã được chấp nhận, xác nhận giao dịch trong ví để hoàn tất xác thực sinh viên.\nReturn to SqrtFund and enter this code in the email verification dialog. Once accepted, confirm the wallet transaction to complete student verification.\n\nKhông chia sẻ mã này. SqrtFund không yêu cầu private key hay seed phrase của ví.\nDo not share this code. SqrtFund will never ask for your wallet private key or seed phrase.\n\nNếu bạn không yêu cầu mã, hãy bỏ qua email này.\nIf you did not request this code, ignore this email.\n\nSqrtFund · Quadratic funding for student communities.`;
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${subject}</title>
  <style>
    body, table, td, p, h1 { margin: 0; padding: 0; }
    table { border-collapse: collapse; }
    @media only screen and (max-width: 620px) {
      .email-wrap { padding: 20px 12px !important; }
      .email-content { padding: 28px 22px !important; }
      .email-header { padding: 22px !important; }
      .email-title { font-size: 32px !important; line-height: 39px !important; }
      .email-code { font-size: 38px !important; letter-spacing: 7px !important; }
      .email-footer { padding: 22px !important; }
      .header-label { font-size: 9px !important; letter-spacing: 1px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a10;color:#f2f1ec;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">Mã xác thực email trường của bạn có hiệu lực 10 phút. / Your university email verification code is valid for 10 minutes.</div>
  <table role="presentation" width="100%" bgcolor="#0a0a10" style="width:100%;background-color:#0a0a10;">
    <tr><td class="email-wrap" align="center" style="padding:44px 16px;">
      <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
      <table role="presentation" width="100%" bgcolor="#0d0d14" style="width:100%;max-width:600px;background-color:#0d0d14;border:1px solid #23232e;">
        <tr><td height="4" bgcolor="#e84142" style="height:4px;font-size:0;line-height:0;background-color:#e84142;background-image:linear-gradient(90deg,#5eead4 0%,#6366f1 35%,#a78bfa 65%,#fb923c 100%);">&nbsp;</td></tr>
        <tr><td class="email-header" style="padding:26px 34px;border-bottom:1px solid #23232e;">
          <table role="presentation" width="100%" style="width:100%;"><tr>
            <td style="white-space:nowrap;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-1px;color:#f2f1ec;"><span style="color:#e84142;">√</span>&nbsp;Sqrt<span style="color:#e84142;">Fund</span></td>
            <td align="right" class="header-label" style="font-family:'Courier New',Courier,monospace;font-size:10px;line-height:16px;letter-spacing:1.5px;color:#9a9ab0;">STUDENT<br>VERIFICATION</td>
          </tr></table>
        </td></tr>
        <tr><td class="email-content" style="padding:34px;">
          <p style="font-family:'Courier New',Courier,monospace;font-size:10px;line-height:16px;font-weight:700;letter-spacing:2px;color:#e84142;">01 / VERIFY YOUR EMAIL</p>
          <h1 class="email-title" style="margin:14px 0 16px;font-size:39px;line-height:46px;letter-spacing:-1.5px;font-weight:700;color:#f2f1ec;">Xác thực<br>email trường<span style="color:#e84142;">.</span></h1>
          <p style="font-size:14px;line-height:23px;color:#c3c2d0;">Thêm một bước để tham gia cộng đồng SqrtFund. Nhập mã bên dưới vào cửa sổ xác thực trong ứng dụng.</p>
          <p lang="en" style="margin-top:9px;font-size:12px;line-height:20px;color:#9a9ab0;">You're one step closer to the SqrtFund community. Enter this code in the app's email verification dialog.</p>
          <table role="presentation" width="100%" style="width:100%;margin-top:27px;">
            <tr><td align="center" bgcolor="#12121b" style="padding:24px 12px;background-color:#12121b;border:1px solid #633034;border-top:2px solid #e84142;">
              <p style="font-family:'Courier New',Courier,monospace;font-size:10px;line-height:16px;letter-spacing:1.5px;color:#9a9ab0;">MÃ XÁC THỰC / VERIFICATION CODE</p>
              <p class="email-code" dir="ltr" style="margin:15px 0 16px;font-family:'Courier New',Courier,monospace;font-size:46px;line-height:54px;font-weight:700;letter-spacing:10px;color:#f2f1ec;white-space:nowrap;">${otp}</p>
              <p style="font-family:'Courier New',Courier,monospace;font-size:11px;line-height:18px;color:#ff7778;">HIỆU LỰC 10 PHÚT &nbsp;/&nbsp; VALID FOR 10 MIN</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" style="width:100%;margin-top:26px;">
            <tr><td width="29" valign="top" style="width:29px;padding-top:1px;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:20px;color:#e84142;">02</td>
              <td style="font-size:12px;line-height:20px;color:#c3c2d0;">Sau khi mã được chấp nhận, xác nhận giao dịch trong ví để hoàn tất xác thực sinh viên.<br><span lang="en" style="font-size:11px;color:#9a9ab0;">Once accepted, confirm the wallet transaction to finish student verification.</span></td>
            </tr>
          </table>
          <table role="presentation" width="100%" style="width:100%;margin-top:23px;">
            <tr><td style="padding:14px 16px;border-left:2px solid #e84142;background-color:#191319;font-size:11px;line-height:18px;color:#c3c2d0;">Không chia sẻ mã này. SqrtFund không yêu cầu private key hoặc seed phrase của ví.<br><span lang="en" style="color:#9a9ab0;">Keep this code private. SqrtFund will never ask for your wallet private key or seed phrase.</span></td></tr>
          </table>
        </td></tr>
        <tr><td class="email-footer" style="padding:23px 34px;border-top:1px solid #23232e;">
          <p style="font-size:11px;line-height:18px;color:#9a9ab0;">Không phải bạn yêu cầu? Bạn có thể bỏ qua email này.<br><span lang="en">Didn't request this? You can safely ignore this email.</span></p>
          <p style="margin-top:17px;font-family:'Courier New',Courier,monospace;font-size:9px;line-height:16px;letter-spacing:1px;color:#747487;">SQRTFUND &nbsp;·&nbsp; BUILT FOR STUDENT COMMUNITIES</p>
        </td></tr>
        <tr><td height="2" bgcolor="#e84142" style="height:2px;font-size:0;line-height:0;background-color:#e84142;background-image:linear-gradient(90deg,#5eead4,#6366f1,#a78bfa,#fb923c);">&nbsp;</td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:20px 0 0;font-family:'Courier New',Courier,monospace;font-size:9px;line-height:16px;letter-spacing:1.5px;color:#747487;">SMALL CONTRIBUTIONS. COLLECTIVE IMPACT.</p>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

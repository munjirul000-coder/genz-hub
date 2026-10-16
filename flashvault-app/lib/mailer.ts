// Email sender — Gmail SMTP (free) or any SMTP provider
// Setup: Gmail e 2FA on koro -> App Password create koro -> env e boshao:
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=yourmail@gmail.com  SMTP_PASS=16-char-app-password
// SMTP na thakle email pathano SKIP hoy (site kaj kore, verification pending thake)

import nodemailer from "nodemailer";

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getTransporter() {
  if (!isEmailConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(`[mailer] SMTP not configured — email to ${to} skipped (subject: ${subject})`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `FlashVault BD <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " "),
    });
    return true;
  } catch (e) {
    console.error("[mailer] send failed", e);
    return false;
  }
}

// Brand-styled verification email (off-white/ink, minimal — matches site)
export function verificationEmailHtml(name: string, link: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f7f3ec;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ece6d9;border-radius:16px;overflow:hidden;">
      <div style="background:#0a0a0a;padding:20px 28px;">
        <span style="color:#ffffff;font-weight:800;font-size:20px;letter-spacing:-0.5px;">FLASH</span><span style="color:#a8a29a;font-style:italic;font-size:20px;">Vault</span>
        <span style="color:#f59e0b;font-size:11px;font-family:monospace;letter-spacing:2px;margin-left:12px;">BD</span>
      </div>
      <div style="padding:32px 28px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#0a0a0a;">Verify your email</h2>
        <p style="margin:0 0 8px;color:#3d3a35;font-size:14px;line-height:1.6;">Hi ${name},</p>
        <p style="margin:0 0 24px;color:#3d3a35;font-size:14px;line-height:1.6;">
          Your FlashVault account is almost ready. Confirm this email address to secure your account.
        </p>
        <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#fdfcfa;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">Verify Email →</a>
        <p style="margin:24px 0 0;color:#7a7670;font-size:12px;line-height:1.6;">
          Link expires in 24 hours. If you didn't create this account, ignore this email — nothing will happen.
        </p>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #ece6d9;color:#7a7670;font-size:11px;font-family:monospace;">
        FLASHVAULT BD • FRIDAY 9PM • SURPLUS, NOT WASTE
      </div>
    </div>
  </div>`;
}

// Login alert (security notification)
export function loginAlertEmailHtml(name: string, when: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f7f3ec;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ece6d9;border-radius:16px;overflow:hidden;">
      <div style="background:#0a0a0a;padding:20px 28px;">
        <span style="color:#ffffff;font-weight:800;font-size:20px;">FLASH</span><span style="color:#a8a29a;font-style:italic;font-size:20px;">Vault</span>
      </div>
      <div style="padding:32px 28px;">
        <h2 style="margin:0 0 12px;font-size:18px;color:#0a0a0a;">New login to your account</h2>
        <p style="margin:0 0 8px;color:#3d3a35;font-size:14px;">Hi ${name},</p>
        <p style="margin:0 0 16px;color:#3d3a35;font-size:14px;line-height:1.6;">
          Your FlashVault account was just logged in.<br/>
          <strong>Time:</strong> ${when} (Asia/Dhaka)
        </p>
        <p style="margin:0;color:#7a7670;font-size:13px;line-height:1.6;">
          Wasn't you? Change your password immediately and contact support.
        </p>
      </div>
    </div>
  </div>`;
}

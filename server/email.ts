// Email service using Resend (same as Boomerang)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Green Bazaar <onboarding@resend.dev>';

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL SKIPPED - No API key] To: ${to}, Subject: ${subject}`);
    return true; // Don't block registration if no email configured
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    const data: any = await res.json();
    if (!res.ok) { console.error('[EMAIL FAILED]', data); return false; }
    console.log(`[EMAIL SENT] To: ${to}, ID: ${data.id}`);
    return true;
  } catch (err) { console.error('[EMAIL ERROR]', err); return false; }
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function verifyEmailHtml(code: string): string {
  return `<div style="font-family:'Inter',sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#F5F0E8;">
    <div style="background:#2A4139;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
      <h2 style="color:#F5F0E8;margin:0;">🌿 მწვანე ბაზარი</h2>
      <p style="color:#8B9E7C;margin:4px 0 0;font-size:13px;">Plant Marketplace Georgia</p>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">
      <p style="color:#333;font-size:15px;">Welcome! Your verification code is:</p>
      <div style="background:#F5F0E8;border:2px solid #2A4139;border-radius:10px;padding:18px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#2A4139;margin:16px 0;">${code}</div>
      <p style="color:#999;font-size:13px;">This code expires in 15 minutes.</p>
      <p style="color:#999;font-size:13px;">If you didn't create an account, ignore this email.</p>
    </div>
  </div>`;
}

export function orderNotificationHtml(title: string, body: string): string {
  return `<div style="font-family:'Inter',sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#F5F0E8;">
    <div style="background:#2A4139;padding:16px 20px;border-radius:10px 10px 0 0;">
      <h2 style="color:#F5F0E8;margin:0;font-size:16px;">🌿 მწვანე ბაზარი</h2>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">
      <h3 style="color:#2A4139;margin:0 0 8px;">${title}</h3>
      <p style="color:#555;font-size:14px;line-height:1.6;">${body}</p>
      <a href="https://bazaar.green" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#B8704B;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;">View on Green Bazaar</a>
    </div>
  </div>`;
}

export function resetPasswordHtml(code: string): string {
  return `<div style="font-family:'Inter',sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#F5F0E8;">
    <div style="background:#2A4139;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
      <h2 style="color:#F5F0E8;margin:0;">🌿 Password Reset</h2>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">
      <p style="color:#333;">Your password reset code:</p>
      <div style="background:#F5F0E8;border:2px solid #B8704B;border-radius:10px;padding:18px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#B8704B;margin:16px 0;">${code}</div>
      <p style="color:#999;font-size:13px;">Expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>
  </div>`;
}

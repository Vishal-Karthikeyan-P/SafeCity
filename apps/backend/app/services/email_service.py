"""
Email Service -- async SMTP email sender for SafeCity OTP emails.

IMPORTANT: Never log OTP values or SMTP credentials.
Uses aiosmtplib for non-blocking email delivery in FastAPI async context.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_otp_email_html(otp: str, expiry_minutes: int) -> str:
    """Build a professional SafeCity-branded HTML OTP email."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SafeCity Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:500px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%);padding:32px 40px;text-align:center;">
              <span style="font-size:32px;">🛡️</span>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">SafeCity</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Smart City Safety Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:700;">Password Reset Request</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                We received a request to reset the password for your SafeCity account.
                Use the OTP below to proceed. This code is valid for <strong>{expiry_minutes} minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background:#f1f5f9;border:2px dashed #3b82f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your One-Time Password</p>
                <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#1d4ed8;font-family:monospace;">{otp}</p>
              </div>

              <!-- Warning -->
              <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                  <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone.
                  SafeCity staff will never ask for this code. If you did not request a password reset,
                  please ignore this email — your account is safe.
                </p>
              </div>

              <p style="margin:0;color:#94a3b8;font-size:12px;">
                This OTP expires in <strong>{expiry_minutes} minutes</strong> and can only be used once.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; 2026 SafeCity Platform. This is an automated message — please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_otp_email(to_email: str, otp: str, expiry_minutes: int) -> bool:
    """
    Send the OTP password-reset email to the user.

    Returns True on success, False if SMTP is not configured or sending fails.
    OTP value is NEVER logged.
    """
    # Check configuration
    if not settings.SMTP_HOST or not (settings.SMTP_USERNAME or settings.SMTP_USER):
        logger.warning(
            "SMTP not configured properly (SMTP_HOST=%s, SMTP_USERNAME=%s). Forgot-password email not sent.",
            settings.SMTP_HOST,
            settings.SMTP_USERNAME or settings.SMTP_USER,
        )
        return False

    smtp_username = settings.SMTP_USERNAME or settings.SMTP_USER
    from_email = settings.SMTP_FROM_EMAIL or smtp_username or settings.EMAILS_FROM_EMAIL
    from_name = settings.SMTP_FROM_NAME

    try:
        import aiosmtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "SafeCity — Your Password Reset OTP"
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email

        html_body = _build_otp_email_html(otp, expiry_minutes)
        text_body = (
            f"SafeCity Password Reset\n\n"
            f"Your OTP: {otp}\n\n"
            f"This code expires in {expiry_minutes} minutes.\n"
            f"Do NOT share this OTP with anyone.\n\n"
            f"If you did not request a password reset, ignore this email."
        )
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=smtp_username,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("OTP email successfully sent via SMTP to %s", to_email)
        return True

    except Exception as exc:
        # Log exact error details for debugging (NOT the OTP or password)
        logger.error("Failed to send OTP email to %s via %s:%s - Error: %s: %s", to_email, settings.SMTP_HOST, settings.SMTP_PORT, type(exc).__name__, exc)
        return False

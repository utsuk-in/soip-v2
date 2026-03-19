"""
Email service — sends student invitation emails with magic link.

Uses SMTP for delivery. Falls back to console logging when SMTP is not configured.
The HTML template is embedded here for easy reference and modification.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _build_invite_html(
    student_name: str,
    magic_link_url: str,
    token_validity_hours: int = 72,
) -> str:
    """Build a professional HTML invite email."""

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Steppd</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#4f46e5;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                Steppd
              </h1>
              <p style="margin:8px 0 0;color:#c7d2fe;font-size:13px;font-weight:400;">
                Explore, Grow, Launch
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 28px;">
              <h2 style="margin:0 0 12px;color:#1c1917;font-size:20px;font-weight:600;">
                Welcome, {student_name}!
              </h2>
              <p style="margin:0 0 12px;color:#57534e;font-size:15px;line-height:1.6;">
                You've been invited to join <strong>Steppd</strong> &mdash; an AI-powered platform
                that helps you discover hackathons, internships, fellowships, grants, scholarships,
                and more, tailored to your skills and interests.
              </p>
              <p style="margin:0 0 20px;color:#57534e;font-size:15px;line-height:1.6;">
                Click the button below to set up your account and start exploring opportunities:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{magic_link_url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="25%" fillcolor="#4f46e5">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Sign Up &amp; Get Started &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{magic_link_url}"
                       target="_blank"
                       style="display:inline-block;padding:14px 40px;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;mso-hide:all;">
                      Sign Up &amp; Get Started &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Token info box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#0369a1;font-size:13px;font-weight:600;">
                      Important &mdash; Link Validity
                    </p>
                    <p style="margin:0;color:#0c4a6e;font-size:13px;line-height:1.5;">
                      This invitation link is valid for <strong>{token_validity_hours} hours</strong>
                      and can only be used once. If it expires, please contact your administrator
                      to receive a new invite.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 24px;border-top:1px solid #e7e5e4;">
              <p style="margin:0;color:#a8a29e;font-size:12px;line-height:1.5;text-align:center;">
                This is an automated message from Steppd. Please do not reply to this email.<br/>
                &copy; 2026 Steppd &mdash; Explore, Grow, Launch
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_invite_text(
    student_name: str,
    token_validity_hours: int = 72,
) -> str:
    """Build a plain-text fallback for the invite email."""
    return (
        f"Welcome to Steppd, {student_name}!\n\n"
        f"You've been invited to join Steppd — an AI-powered platform "
        f"that helps you discover hackathons, internships, fellowships, grants, "
        f"scholarships, and more.\n\n"
        f"Please use the Sign Up button in this email to get started.\n\n"
        f"IMPORTANT: This link is valid for {token_validity_hours} hours and "
        f"can only be used once. If it expires, contact your administrator "
        f"for a new invite.\n\n"
        f"— Steppd Team"
    )


def _build_password_reset_html(
    reset_url: str,
    token_validity_minutes: int = 30,
) -> str:
    """Build a professional HTML password reset email."""

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#4f46e5;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                Steppd
              </h1>
              <p style="margin:8px 0 0;color:#c7d2fe;font-size:13px;font-weight:400;">
                Explore, Grow, Launch
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 28px;">
              <h2 style="margin:0 0 12px;color:#1c1917;font-size:20px;font-weight:600;">
                Reset Your Password
              </h2>
              <p style="margin:0 0 12px;color:#57534e;font-size:15px;line-height:1.6;">
                We received a request to reset the password for your <strong>Steppd</strong> account.
                Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 24px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{reset_url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="25%" fillcolor="#4f46e5">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Reset Password &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{reset_url}"
                       target="_blank"
                       style="display:inline-block;padding:14px 40px;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;mso-hide:all;">
                      Reset Password &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Token info box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#92400e;font-size:13px;font-weight:600;">
                      Important &mdash; Link Expires Soon
                    </p>
                    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.5;">
                      This link is valid for <strong>{token_validity_minutes} minutes</strong>.
                      If you did not request a password reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 24px;border-top:1px solid #e7e5e4;">
              <p style="margin:0;color:#a8a29e;font-size:12px;line-height:1.5;text-align:center;">
                This is an automated message from Steppd. Please do not reply to this email.<br/>
                &copy; 2026 Steppd &mdash; Explore, Grow, Launch
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_password_reset_text(
    token_validity_minutes: int = 30,
) -> str:
    """Build a plain-text fallback for the password reset email."""
    return (
        "Reset Your Password\n\n"
        "We received a request to reset the password for your Steppd account.\n"
        "Please use the Reset Password button in this email to choose a new password.\n\n"
        f"IMPORTANT: This link is valid for {token_validity_minutes} minutes. "
        "If you did not request a password reset, you can safely ignore this email.\n\n"
        "— Steppd Team"
    )


def send_password_reset_email(
    to_email: str,
    reset_url: str,
    token_validity_minutes: int = 30,
) -> bool:
    """Send a password reset email. Returns True on success."""

    subject = "Reset Your Steppd Password"

    html_body = _build_password_reset_html(reset_url, token_validity_minutes)
    text_body = _build_password_reset_text(token_validity_minutes)

    if not settings.smtp_host:
        logger.info(
            "[EMAIL-PREVIEW] To: %s | Subject: %s\n%s",
            to_email, subject, text_body,
        )
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)

        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)

        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        server.quit()
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send password reset email to %s: %s", to_email, e)
        return False


def send_invite_email(
    to_email: str,
    student_name: str,
    magic_link_url: str,
    token_validity_hours: int = 72,
) -> bool:
    """Send the student invitation email. Returns True on success."""

    subject = "You're Invited to Steppd — Set Up Your Account"

    html_body = _build_invite_html(student_name, magic_link_url, token_validity_hours)
    text_body = _build_invite_text(student_name, token_validity_hours)

    if not settings.smtp_host:
        logger.info(
            "[EMAIL-PREVIEW] To: %s | Subject: %s\n%s",
            to_email, subject, text_body,
        )
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)

        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)

        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        server.quit()
        logger.info("Invite email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send invite email to %s: %s", to_email, e)
        return False

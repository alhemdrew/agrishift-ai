import logging

import httpx

from app.config import get_settings

log = logging.getLogger("agrishift.email")
RESEND_URL = "https://api.resend.com/emails"


class EmailError(Exception):
    pass


def send_email(to: str, subject: str, text: str, html: str) -> None:
    settings = get_settings()

    if settings.email_provider == "console":
        # Local development: the link is printed so you can test without an email provider
        log.warning("\n----- EMAIL to %s -----\nSubject: %s\n%s\n-----------------------", to, subject, text)
        return

    if settings.email_provider == "resend":
        try:
            response = httpx.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html, "text": text},
                timeout=10,
            )
        except httpx.HTTPError as exc:
            log.exception("Resend request failed")
            raise EmailError("Could not reach the email service.") from exc
        if response.status_code >= 400:
            log.error("Resend rejected email: %s %s", response.status_code, response.text)
            raise EmailError("The email service rejected the message.")
        return

    raise EmailError(f"Unknown EMAIL_PROVIDER: {settings.email_provider}")


def send_verification_email(to: str, name: str, link: str) -> None:
    send_email(
        to,
        "Verify your AgriShift account",
        f"Hi {name},\n\nConfirm your email to activate your account:\n{link}\n\nThis link expires in 24 hours.",
        f"<p>Hi {name},</p><p>Confirm your email to activate your account:</p>"
        f'<p><a href="{link}">Verify my email</a></p><p>This link expires in 24 hours.</p>',
    )


def send_password_reset_email(to: str, name: str, link: str) -> None:
    send_email(
        to,
        "Reset your AgriShift password",
        f"Hi {name},\n\nReset your password using this link:\n{link}\n\n"
        "This link expires in 30 minutes. If you didn't request this, ignore this email.",
        f"<p>Hi {name},</p><p>Reset your password using this link:</p>"
        f'<p><a href="{link}">Reset my password</a></p>'
        "<p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>",
    )

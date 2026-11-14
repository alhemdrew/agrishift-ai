import logging

import httpx

from app.config import settings

log = logging.getLogger("agrishift.email")


class EmailDeliveryError(Exception):
    pass


def send_email(to_email: str, to_name: str, subject: str, text: str, html: str) -> None:
    """Sends through Brevo's HTTPS API. Uses port 443, so it works where SMTP ports are blocked."""
    if not settings.brevo_api_key:
        # Development fallback: print the email so you can copy the link.
        log.warning("BREVO_API_KEY not set. Email printed instead of sent.\nTo: %s\nSubject: %s\n%s",
                    to_email, subject, text)
        return

    payload = {
        "sender": {"name": settings.email_from_name, "email": settings.email_from_address},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    headers = {"api-key": settings.brevo_api_key, "accept": "application/json", "content-type": "application/json"}

    try:
        response = httpx.post(settings.brevo_api_url, json=payload, headers=headers, timeout=10)
    except httpx.HTTPError as exc:
        log.exception("Brevo request failed")
        raise EmailDeliveryError("Could not reach the email service") from exc

    if response.status_code >= 300:
        log.error("Brevo rejected the email: %s %s", response.status_code, response.text)
        raise EmailDeliveryError(f"Email service returned {response.status_code}")


def send_verification_email(to_email: str, name: str, link: str) -> None:
    send_email(
        to_email, name, "Verify your AgriShift email",
        text=f"Hi {name},\n\nConfirm your email to activate your AgriShift account:\n{link}\n\nThis link expires in 24 hours.",
        html=f"<p>Hi {name},</p><p>Confirm your email to activate your AgriShift account:</p>"
             f'<p><a href="{link}">Verify my email</a></p><p>This link expires in 24 hours.</p>',
    )


def send_reset_email(to_email: str, name: str, link: str) -> None:
    send_email(
        to_email, name, "Reset your AgriShift password",
        text=f"Hi {name},\n\nUse this link to set a new password:\n{link}\n\nThis link expires in 30 minutes. "
             "If you didn't request it, you can ignore this email.",
        html=f"<p>Hi {name},</p><p>Use this link to set a new password:</p>"
             f'<p><a href="{link}">Reset my password</a></p>'
             "<p>This link expires in 30 minutes. If you didn't request it, you can ignore this email.</p>",
    )

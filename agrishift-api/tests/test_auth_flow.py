import re
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PASSWORD = "Harvest2026"


def new_email(prefix="farmer"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@agrishift-qa.com"


def token_from(sent_email: dict) -> str:
    match = re.search(r"token=([A-Za-z0-9_\-]+)", sent_email["textContent"])
    assert match, "no token link found in email"
    return match.group(1)


def signup_and_verify(email, sent):
    r = client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    verify_token = token_from(sent[-1])
    r = client.post("/api/auth/verify-email", json={"token": verify_token})
    assert r.status_code == 200, r.text
    return verify_token


def test_signup_sends_verification_email_through_brevo(sent):
    email = new_email()
    r = client.post("/api/auth/signup", json={"name": "  Ada Okafor ", "email": email.upper(), "password": PASSWORD})
    assert r.status_code == 201
    assert len(sent) == 1
    mail = sent[0]
    assert mail["to"][0]["email"] == email  # lowercased
    assert mail["subject"] == "Verify your AgriShift email"
    assert mail["sender"]["email"] == "no-reply@agrishift-qa.com"
    assert "/verify-email?token=" in mail["textContent"]


def test_duplicate_signup_is_rejected(sent):
    email = new_email()
    client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": email, "password": PASSWORD})
    r = client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": email, "password": PASSWORD})
    assert r.status_code == 409
    assert r.json()["detail"] == "An account with this email already exists."


@pytest.mark.parametrize("password,message", [
    ("short1", "Use at least 8 characters."),
    ("nodigitshere", "Include at least one letter and one number."),
    ("12345678", "Include at least one letter and one number."),
])
def test_weak_passwords_return_clean_message(password, message):
    r = client.post("/api/auth/signup", json={"name": "Ada", "email": new_email(), "password": password})
    assert r.status_code == 422
    assert r.json() == {"detail": message}


def test_bad_email_returns_clean_message():
    r = client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": "not-an-email", "password": PASSWORD})
    assert r.status_code == 422
    assert r.json()["detail"] == "Enter a valid email address."


def test_login_blocked_until_email_verified(sent):
    email = new_email()
    client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": email, "password": PASSWORD})
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 403


def test_verify_link_works_once(sent):
    email = new_email()
    client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": email, "password": PASSWORD})
    token = token_from(sent[-1])
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    r = client.post("/api/auth/verify-email", json={"token": token})
    assert r.status_code == 400
    assert r.json()["detail"] == "This verification link is invalid or has expired."


def test_login_logout_session_cookie(sent):
    email = new_email()
    signup_and_verify(email, sent)
    c = TestClient(app)

    assert c.get("/api/auth/me").status_code == 401
    assert c.post("/api/auth/login", json={"email": email, "password": "Wrong12345"}).status_code == 401

    r = c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == email
    cookie = r.headers["set-cookie"]
    assert "as_session=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie

    me = c.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["user"]["email"] == email

    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").status_code == 401


def test_forgot_password_is_uniform_for_unknown_email(sent):
    r = client.post("/api/auth/forgot-password", json={"email": new_email("nobody")})
    assert r.status_code == 200
    assert "If an account exists" in r.json()["message"]
    assert sent == []  # nothing sent for unknown accounts


def test_full_password_reset_flow(sent):
    email = new_email()
    signup_and_verify(email, sent)
    c = TestClient(app)
    c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert c.get("/api/auth/me").status_code == 200

    sent.clear()
    r = client.post("/api/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    assert len(sent) == 1 and sent[0]["subject"] == "Reset your AgriShift password"
    reset_token = token_from(sent[0])

    new_pw = "NewHarvest2026"
    r = client.post("/api/auth/reset-password", json={"token": reset_token, "password": new_pw})
    assert r.status_code == 200, r.text

    # Reset signs out existing sessions
    assert c.get("/api/auth/me").status_code == 401
    # Old password no longer works, new one does
    assert client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": new_pw}).status_code == 200

    # Reset link is single-use
    r = client.post("/api/auth/reset-password", json={"token": reset_token, "password": "AnotherPass1"})
    assert r.status_code == 400


def test_reset_rejects_garbage_token():
    r = client.post("/api/auth/reset-password", json={"token": "x" * 20, "password": PASSWORD})
    assert r.status_code == 400


def test_signup_email_failure_rolls_back_so_user_can_retry(sent):
    email = f"fail-{uuid.uuid4().hex[:6]}@agrishift-qa.com"
    r = client.post("/api/auth/signup", json={"name": "Ada Okafor", "email": email, "password": PASSWORD})
    assert r.status_code == 503
    # No half-created account was left behind
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 401

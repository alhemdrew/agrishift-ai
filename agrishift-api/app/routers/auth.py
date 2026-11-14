import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import SESSION_COOKIE, get_active_token, get_current_user
from app.emailer import EmailDeliveryError, send_reset_email, send_verification_email
from app.models import AuthToken, User
from app.schemas import EmailIn, LoginIn, ResetPasswordIn, SignupIn, TokenIn
from app.security import hash_password, hash_token, new_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("agrishift.auth")

SESSION_DAYS = 7
VERIFY_HOURS = 24
RESET_MINUTES = 30

# Used to keep login timing similar whether or not the email exists
_DUMMY_HASH = hash_password("not-a-real-password-1")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _issue_token(db: Session, user_id, purpose: str, ttl: timedelta) -> str:
    raw = new_token()
    db.add(AuthToken(user_id=user_id, purpose=purpose, token_hash=hash_token(raw), expires_at=_now() + ttl))
    return raw


def _public_user(user: User) -> dict:
    return {"id": str(user.id), "email": user.email, "name": user.name}


@router.post("/signup", status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    raw = _issue_token(db, user.id, "verify_email", timedelta(hours=VERIFY_HOURS))
    link = f"{settings.frontend_url}/verify-email?token={raw}"

    try:
        send_verification_email(user.email, user.name, link)
    except EmailDeliveryError:
        # Roll back so the user can try signing up again once email works
        db.rollback()
        raise HTTPException(status_code=503, detail="We couldn't send the verification email. Please try again shortly.")

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    return {"message": "Account created. Check your email to verify your address."}


@router.post("/verify-email")
def verify_email(body: TokenIn, db: Session = Depends(get_db)):
    row = get_active_token(db, body.token, "verify_email")
    if row is None:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")

    user = db.get(User, row.user_id)
    user.email_verified_at = user.email_verified_at or _now()
    row.used_at = _now()
    db.commit()
    return {"message": "Email verified. You can now sign in."}


@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None:
        verify_password(body.password, _DUMMY_HASH)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if user.email_verified_at is None:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")

    raw = _issue_token(db, user.id, "session", timedelta(days=SESSION_DAYS))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE, raw, httponly=True, secure=settings.cookie_secure, samesite="lax",
        max_age=SESSION_DAYS * 86400, path="/",
    )
    return {"user": _public_user(user)}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(SESSION_COOKIE)
    if raw:
        row = get_active_token(db, raw, "session")
        if row:
            row.used_at = _now()
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"message": "Signed out."}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": _public_user(user)}


@router.post("/forgot-password")
def forgot_password(body: EmailIn, db: Session = Depends(get_db)):
    # Same response whether or not the account exists, so the form can't be used to find accounts
    user = db.scalar(select(User).where(User.email == body.email))
    if user is not None and user.email_verified_at is not None:
        raw = _issue_token(db, user.id, "reset_password", timedelta(minutes=RESET_MINUTES))
        db.commit()
        link = f"{settings.frontend_url}/reset-password?token={raw}"
        try:
            send_reset_email(user.email, user.name, link)
        except EmailDeliveryError:
            log.error("Reset email failed for user %s", user.id)

    return {"message": "If an account exists for that email, a reset link is on its way."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    row = get_active_token(db, body.token, "reset_password")
    if row is None:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user = db.get(User, row.user_id)
    user.password_hash = hash_password(body.password)
    now = _now()
    row.used_at = now
    # Sign out everywhere and invalidate any other reset links for this account
    db.execute(
        update(AuthToken)
        .where(AuthToken.user_id == user.id, AuthToken.purpose.in_(["session", "reset_password"]),
               AuthToken.used_at.is_(None))
        .values(used_at=now)
    )
    db.commit()
    return {"message": "Password updated. Please sign in with your new password."}

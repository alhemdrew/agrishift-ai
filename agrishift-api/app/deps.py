from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuthToken, User
from app.security import hash_token

SESSION_COOKIE = "as_session"


def get_active_token(db: Session, raw_token: str, purpose: str) -> AuthToken | None:
    """Returns the token row only if it matches, is unused, and has not expired."""
    row = db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(raw_token)))
    if row is None or row.purpose != purpose or row.used_at is not None:
        return None
    if row.expires_at <= datetime.now(timezone.utc):
        return None
    return row


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    raw = request.cookies.get(SESSION_COOKIE)
    if not raw:
        raise HTTPException(status_code=401, detail="You need to sign in.")
    row = get_active_token(db, raw, "session")
    if row is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="You need to sign in.")
    return user

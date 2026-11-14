# Agri Shift API

FastAPI backend for authentication: sign up, email verification, login, logout, forgot and reset password.
Data lives in PostgreSQL (Supabase). Email is sent through Brevo's HTTPS API.

## 1. Requirements

- Python 3.10 or newer (tested on 3.12)
- A Supabase project (see step 3)
- A Brevo account with an API key and a verified sender (see step 4)

## 2. Install

```bash
cd agrishift-api
python -m venv .venv
source .venv/Scripts/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env
```
python -m uvicorn app.main:app --reload --port 8000


## 3. Supabase (database)

Use a **new Supabase project for Agri Shift**. Don't put it inside TalkSense's project, because both apps would
create a table called `users`. The free plan allows two active projects, so TalkSense and Agri Shift can each have one.

1. Go to supabase.com, click **New project**, name it `agrishift`, choose a region close to you, and set a database password. **Save the password.**
2. When the project is ready, click **Connect** at the top of the dashboard.
3. Choose **Session pooler** and copy the URI. It looks like:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`
4. Replace `[YOUR-PASSWORD]` with your password. If the password has special characters, URL-encode them (`@` becomes `%40`, `#` becomes `%23`, `/` becomes `%2F`).
5. Put it in `.env` as `DATABASE_URL=...` and keep `?sslmode=require` at the end.

The Session pooler works on IPv4 networks. The direct connection is IPv6 only on some plans, which often fails from home networks.

The tables are created automatically the first time the API starts. You'll see `users` and `auth_tokens` in the Supabase Table Editor.

## 4. Brevo (email)

1. Sign up at brevo.com and confirm your account.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender.** Use an email address you can open. Confirm it from the email Brevo sends you. Brevo only sends from verified senders.
3. Go to **SMTP & API → API Keys → Generate a new API key**. Copy the key. It starts with `xkeysib-`. Use the **API key**, not the SMTP key.
4. In `.env`, set:
   ```
   BREVO_API_KEY=xkeysib-...
   EMAIL_FROM_ADDRESS=the-sender-you-verified@example.com
   EMAIL_FROM_NAME=Agri Shift
   ```

This connects over HTTPS (port 443), so it works where Gmail's SMTP ports are blocked. Brevo's free plan allows 300 emails a day.

Leave `BREVO_API_KEY` empty during early development. The API then prints each email, including the link, to the terminal, so you can test without sending mail.

## 5. Run

```bash
uvicorn app.main:app --reload --port 8000
```

Check it's up: open http://localhost:8000/health (should show `{"status":"ok"}`) and the interactive docs at http://localhost:8000/docs.

## 6. Test

```bash
pytest -q
```

The tests run the whole flow against your database: signup, verification, login, logout, reset password, and the rejection cases.
They use a stand-in for Brevo, so no real emails are sent. They create users ending in `@agrishift-qa.com` and delete them afterwards.

## Endpoints

All bodies are JSON. Errors return `{"detail": "message"}`.

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `name, email, password` | 201. Sends verification email. 409 if the email exists. |
| POST | `/api/auth/verify-email` | `token` | 200. 400 if invalid or used. |
| POST | `/api/auth/login` | `email, password` | 200 and sets `as_session` cookie. 401 wrong credentials. 403 not verified. |
| POST | `/api/auth/logout` | none | 200 and clears the cookie. |
| GET | `/api/auth/me` | cookie | 200 with the user, or 401. |
| POST | `/api/auth/forgot-password` | `email` | Always 200 (doesn't reveal whether the account exists). |
| POST | `/api/auth/reset-password` | `token, password` | 200. Signs out all sessions. 400 if invalid or used. |

## Security notes

- Passwords are hashed with bcrypt. Tokens are random 32-byte values, and only their SHA-256 hash is stored.
- Verification links expire after 24 hours. Reset links expire after 30 minutes and work once.
- The session cookie is httpOnly and SameSite=lax. Set `COOKIE_SECURE=True` once the site runs on HTTPS.
- Next steps before production: rate limiting on login and forgot-password, and Alembic migrations in place of automatic table creation.

# AgriShift — Web

Next.js frontend for AgriShift: landing page, authentication flow, and the protected `/app` area.

## Run

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your FastAPI server
npm install
npm run dev
```

## Auth routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/login` | Sign in (`?next=` returns the user after sign-in, `?reset=1` shows the reset confirmation) |
| `/signup` | Create account, then `/verify-email?sent=1` |
| `/verify-email?token=` | Confirms email from the link |
| `/forgot-password` | Requests a reset link (same response for every email) |
| `/reset-password?token=` | Sets a new password |
| `/app/*` | Protected. Redirects to `/login` without the `as_session` cookie |

## Backend contract (FastAPI)

All requests are JSON `POST` with `credentials: include`.

- `POST /api/auth/login` `{ email, password }` → sets the `as_session` httpOnly cookie
- `POST /api/auth/signup` `{ name, email, password }`
- `POST /api/auth/verify-email` `{ token }`
- `POST /api/auth/forgot-password` `{ email }`
- `POST /api/auth/reset-password` `{ token, password }`
- `POST /api/auth/logout`

Errors return `{ "detail": "message" }`. Pydantic validation errors are handled automatically.

Theme preference is stored under the `as_theme` key.

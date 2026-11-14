import { NextResponse, type NextRequest } from "next/server";

// Quick first check: no cookie means no access to /app.
// The real check (is this session still valid?) happens in src/app/app/layout.tsx against the backend.
const SESSION_COOKIE = "as_session";

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};

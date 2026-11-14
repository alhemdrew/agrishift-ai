import { NextResponse } from "next/server";

const SESSION_COOKIE = "as_session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; email?: string; password?: string } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();

  if (!name || !email || !body?.password) {
    return NextResponse.json({ detail: "Name, username, and password are required." }, { status: 400 });
  }

  const response = NextResponse.json({ message: "Local workspace created." });
  response.cookies.set(SESSION_COOKIE, "local-workspace", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

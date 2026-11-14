import { NextResponse } from "next/server";

const SESSION_COOKIE = "as_session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email || !body?.password) {
    return NextResponse.json({ detail: "A username and password are required." }, { status: 400 });
  }

  const response = NextResponse.json({
    user: { id: "local-workspace", email, name: email.split("@")[0] || "Local workspace" },
  });
  response.cookies.set(SESSION_COOKIE, "local-workspace", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

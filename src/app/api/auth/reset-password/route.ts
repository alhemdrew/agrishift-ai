import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; password?: string } | null;
  if (!body?.password) {
    return NextResponse.json({ detail: "A new password is required." }, { status: 400 });
  }
  return NextResponse.json({ message: "Password updated for the local workspace." });
}

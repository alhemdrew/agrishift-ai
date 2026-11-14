import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  if (!body?.email?.trim()) {
    return NextResponse.json({ detail: "Email is required." }, { status: 400 });
  }
  return NextResponse.json({ message: "If an account exists, reset instructions are available locally." });
}

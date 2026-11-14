import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) {
    return NextResponse.json({ detail: "A verification token is required." }, { status: 400 });
  }
  return NextResponse.json({ message: "Email verified for the local workspace." });
}

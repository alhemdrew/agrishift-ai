import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const response = await fetch(new URL(`/api/earth/geocode?q=${encodeURIComponent(query)}`, request.url), {
    cache: 'no-store',
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

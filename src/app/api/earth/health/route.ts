import { NextResponse } from 'next/server';
import { fetchObservationHub } from '@/lib/earth-data/hub';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitudeValue = url.searchParams.get('lat');
  const longitudeValue = url.searchParams.get('lon');
  const latitude = latitudeValue === null ? Number.NaN : Number(latitudeValue);
  const longitude = longitudeValue === null ? Number.NaN : Number(longitudeValue);
  const requestedDays = Number(url.searchParams.get('days') ?? 7);
  const days = Number.isFinite(requestedDays) ? Math.min(7, Math.max(1, Math.floor(requestedDays))) : 7;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ detail: 'Valid latitude and longitude are required.' }, { status: 400 });
  }

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const period = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };

  try {
    const hub = await fetchObservationHub({
      latitude,
      longitude,
      startDate: period.start,
      endDate: period.end,
    });
    return NextResponse.json({
      retrievedAt: hub.retrievedAt,
      location: { latitude, longitude },
      period,
      durationMs: hub.durationMs,
      providers: Object.values(hub.sources).map((entry) => entry.diagnostic),
    });
  } catch {
    return NextResponse.json({ detail: 'Earth data health checks could not be completed.' }, { status: 502 });
  }
}

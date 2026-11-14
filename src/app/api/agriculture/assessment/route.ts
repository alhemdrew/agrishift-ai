import { NextResponse } from 'next/server';
import { fetchObservationHub } from '@/lib/earth-data/hub';
import { assessAgriculture } from '@/lib/agriculture/assessment';
import type { FarmProfile } from '@/lib/agriculture/knowledge';

function coordinate(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = coordinate(url.searchParams.get('lat'), -90, 90);
  const longitude = coordinate(url.searchParams.get('lon'), -180, 180);
  if (latitude === null || longitude === null) {
    return NextResponse.json({ detail: 'Valid latitude and longitude are required.' }, { status: 400 });
  }

  const days = Math.min(120, Math.max(7, Number(url.searchParams.get('days') ?? 90)));
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);

  try {
    const hub = await fetchObservationHub({
      latitude,
      longitude,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
    const waterSource = url.searchParams.get('waterSource');
    const profile: FarmProfile = {
      farmSizeHa: Number(url.searchParams.get('farmSizeHa')) || undefined,
      plantingDate: url.searchParams.get('plantingDate')?.slice(0, 10),
      waterSource: waterSource === 'none' || waterSource === 'rainfall' || waterSource === 'well' || waterSource === 'river' || waterSource === 'irrigation'
        ? waterSource
        : undefined,
      previousCrop: url.searchParams.get('previousCrop')?.slice(0, 80),
    };
    return NextResponse.json(assessAgriculture(hub, latitude, longitude, profile));
  } catch {
    return NextResponse.json({ detail: 'Agricultural assessment is temporarily unavailable.' }, { status: 502 });
  }
}

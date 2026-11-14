import { NextResponse } from 'next/server';

import { fetchObservationHub } from '@/lib/earth-data/hub';
import { assessAgriculture } from '@/lib/agriculture/assessment';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitudeValue = url.searchParams.get('lat');
  const longitudeValue = url.searchParams.get('lon');
  const latitude = latitudeValue === null ? Number.NaN : Number(latitudeValue);
  const longitude = longitudeValue === null ? Number.NaN : Number(longitudeValue);
  const requestedDays = Number(url.searchParams.get('days') ?? 90);
  const days = Number.isFinite(requestedDays) ? Math.min(366, Math.max(1, Math.floor(requestedDays))) : 90;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ detail: 'Valid latitude and longitude are required.' }, { status: 400 });
  }
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
    const power = hub.sources.power.result?.observations ?? [];
    const agriculture = assessAgriculture(hub, latitude, longitude);
    const numeric = (variable: string) => power.filter((item) => item.variable === variable && typeof item.value === 'number').map((item) => item.value as number);
    const rain = numeric('PRECTOTCORR');
    const temperature = numeric('T2M');
    const hasValidPower = power.some((item) => typeof item.value === 'number' && Number.isFinite(item.value));
    return NextResponse.json({
      location: { lat: latitude, lon: longitude },
      period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days },
      source: 'NASA POWER',
      summary: {
        avg_temp_c: temperature.length ? temperature.reduce((a, b) => a + b, 0) / temperature.length : null,
        total_rain_mm: rain.length ? rain.reduce((a, b) => a + b, 0) : null,
        rainy_days: rain.length ? rain.filter((value) => value > 0).length : null,
      },
      series: power.filter((item) => item.variable === 'PRECTOTCORR').map((item) => ({ date: item.observationTime.slice(0, 10), prectotcorr: typeof item.value === 'number' ? item.value : null, t2m: null, t2m_max: null })),
      overall: hasValidPower ? 'info' : 'no_data',
      indicators: hasValidPower ? [{ key: 'rainfall_total', name: 'Rainfall', status: 'info', observed: 'Observed by NASA POWER.', why: 'Recent rainfall measurements are available.', limitation: 'This is an observation summary, not a crop-risk prediction.' }] : [],
      method_notes: ['Values are retrieved from the existing PHANTOMGREEN Earth observation hub.'],
      source_health: Object.values(hub.sources).map((entry) => entry.diagnostic),
      agriculture,
    });
  } catch {
    return NextResponse.json({ detail: 'Environmental intelligence is temporarily unavailable.' }, { status: 502 });
  }
}

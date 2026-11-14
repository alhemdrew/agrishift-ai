import { NextResponse } from 'next/server';

import { fetchObservationSource } from '@/lib/earth-data/hub';
import type { Observation } from '@/lib/earth-data/types';

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function values(observations: Observation[], variable: string): number[] {
  return observations
    .filter((observation) => observation.variable === variable && typeof observation.value === 'number')
    .map((observation) => observation.value as number);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitudeValue = url.searchParams.get('lat');
  const longitudeValue = url.searchParams.get('lon');
  const latitude = latitudeValue === null ? Number.NaN : Number(latitudeValue);
  const longitude = longitudeValue === null ? Number.NaN : Number(longitudeValue);
  const requestedDays = Number(url.searchParams.get('days') ?? 30);
  const days = Number.isFinite(requestedDays) ? Math.min(366, Math.max(1, Math.floor(requestedDays))) : 30;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ detail: 'Valid latitude and longitude are required.' }, { status: 400 });
  }

  const start = dateOffset(days);
  const end = dateOffset(1);
  try {
    const query = { latitude, longitude, startDate: start, endDate: end };
    const firmsQuery = {
      ...query,
      startDate: dateOffset(Math.min(days, 5)),
    };
    const [powerResponse, firmsResponse] = await Promise.allSettled([
      fetchObservationSource('power', query),
      fetchObservationSource('firms', firmsQuery),
    ]);
    if (powerResponse.status === 'rejected') throw powerResponse.reason;
    const result = powerResponse.value;
    const firms = firmsResponse.status === 'fulfilled' ? firmsResponse.value : null;
    const observations = result.observations;
    const metric = (variable: string) => {
      const current = values(observations, variable);
      return current.length ? current.reduce((sum, value) => sum + value, 0) / current.length : null;
    };
    const rainfall = observations.filter((observation) => observation.variable === 'PRECTOTCORR');
    const validRainfall = values(observations, 'PRECTOTCORR');
    const validFrp = firms?.observations.filter((observation) => observation.variable === 'frp' && typeof observation.value === 'number') ?? [];
    return NextResponse.json({
      location: { lat: latitude, lon: longitude },
      period: { start, end, days },
      source: result.attribution,
      summary: {
        avg_temp_c: metric('T2M'),
        max_temp_c: metric('T2M_MAX'),
        min_temp_c: metric('T2M_MIN'),
        total_rain_mm: validRainfall.length ? validRainfall.reduce((sum, value) => sum + value, 0) : null,
        rainy_days: validRainfall.length ? validRainfall.filter((value) => value > 0).length : null,
        avg_solar_kwh_m2_day: metric('ALLSKY_SFC_SW_DWN'),
        avg_solar_mj_m2_day: metric('ALLSKY_SFC_SW_DWN'),
        avg_wind_ms: null,
        avg_humidity_pct: metric('RH2M'),
      },
      series: rainfall.map((observation) => ({
        date: observation.observationTime.slice(0, 10),
        prectotcorr: typeof observation.value === 'number' ? observation.value : null,
      })),
      fires: {
        status: firms?.status ?? 'error',
        period: firms?.period ?? { start: firmsQuery.startDate, end: firmsQuery.endDate },
        message: firms?.message ?? 'NASA FIRMS could not be retrieved for the recent five-day window.',
        count: firms?.observations.filter((observation) => observation.variable === 'frp').length ?? 0,
        latestObservationTime: firms?.observations
          .filter((observation) => observation.variable === 'frp')
          .sort((a, b) => b.observationTime.localeCompare(a.observationTime))[0]?.observationTime ?? null,
        totalFrpMw: validFrp.length
          ? validFrp.reduce((sum, observation) => sum + (observation.value as number), 0)
          : null,
      },
    });
  } catch {
    return NextResponse.json({ detail: 'NASA POWER observations are temporarily unavailable.' }, { status: 502 });
  }
}

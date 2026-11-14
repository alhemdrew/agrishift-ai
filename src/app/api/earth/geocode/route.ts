import { NextResponse } from 'next/server';
import type { Geometry } from 'geojson';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  boundingbox?: [string, string, string, string];
  geojson?: Geometry;
  address?: {
    country_code?: string;
    state?: string;
    region?: string;
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', addressdetails: '1' }).toString();
  url.searchParams.set('polygon_geojson', '1');
  url.searchParams.set('polygon_threshold', '0.01');
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AgriShif/0.1 EarthExplorer',
        'Accept-Language': 'en',
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return NextResponse.json({ results: [], status: 'error', message: `Location search returned HTTP ${response.status}.` }, { status: 502 });
    }
    const data = (await response.json()) as NominatimResult[];
    const results = data
      .map((item) => ({
        id: item.place_id,
        name: item.display_name.split(',').slice(0, 3).join(', '),
        displayName: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        resultType: item.type === 'country'
          ? 'Country'
          : item.type === 'capital'
            ? 'Capital'
            : ['city', 'town', 'village', 'municipality'].includes(item.type || '')
              ? 'City or town'
              : item.class === 'boundary'
                ? 'Region'
                : 'Place',
        countryCode: item.address?.country_code?.toUpperCase(),
        regionName: item.address?.state || item.address?.region,
        bounds: item.boundingbox
          ? [Number(item.boundingbox[2]), Number(item.boundingbox[0]), Number(item.boundingbox[3]), Number(item.boundingbox[1])] as [number, number, number, number]
          : undefined,
        boundary: item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon')
          ? item.geojson
          : undefined,
      }))
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    return NextResponse.json({ results, attribution: '© OpenStreetMap contributors; geocoding by Nominatim' }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ results: [], status: 'error', message: 'Location search is temporarily unavailable.' }, { status: 502 });
  }
}
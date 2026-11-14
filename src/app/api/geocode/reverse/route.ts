import { NextResponse } from 'next/server';

interface NominatimReverseResult {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lon'));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ detail: 'Valid latitude and longitude are required.' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    addressdetails: '1',
  }).toString();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AgriShift/0.1 EarthExplorer',
        'Accept-Language': 'en',
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return NextResponse.json({ detail: 'Location lookup is temporarily unavailable.' }, { status: 502 });
    }

    const result = await response.json() as NominatimReverseResult;
    const address = result.address;
    const name = address?.city
      ?? address?.town
      ?? address?.village
      ?? address?.municipality
      ?? address?.county
      ?? address?.state
      ?? result.display_name?.split(',')[0]
      ?? null;

    return NextResponse.json({ name, displayName: result.display_name ?? null });
  } catch {
    return NextResponse.json({ detail: 'Location lookup is temporarily unavailable.' }, { status: 502 });
  }
}

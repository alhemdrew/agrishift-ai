import { NextResponse } from 'next/server';

import { GIBS_CAPABILITIES_URL, GIBS_WMS_ENDPOINT, mapLayerConfigs } from '@/lib/earth-data/map-layers';

let cachedCapabilities: { expiresAt: number; xml: string } | undefined;

async function getCapabilitiesXml(): Promise<string> {
  if (cachedCapabilities && cachedCapabilities.expiresAt > Date.now()) return cachedCapabilities.xml;

  const response = await fetch(GIBS_CAPABILITIES_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`NASA GIBS returned HTTP ${response.status}.`);

  const xml = await response.text();
  cachedCapabilities = { expiresAt: Date.now() + 60 * 60 * 1000, xml };
  return xml;
}

function layerBlock(xml: string, identifier: string): string | null {
  const marker = `<ows:Identifier>${identifier}</ows:Identifier>`;
  const index = xml.indexOf(marker);
  if (index < 0) return null;
  const start = xml.lastIndexOf('<Layer>', index);
  const end = xml.indexOf('</Layer>', index);
  return start < 0 || end < 0 ? null : xml.slice(start, end + '</Layer>'.length);
}

function elementValue(source: string, tag: string): string | undefined {
  const match = source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`));
  return match?.[1]?.trim();
}

function dimensionDate(source: string): string | undefined {
  const dimensions = Array.from(source.matchAll(/<Dimension>([\s\S]*?)<\/Dimension>/g));
  const timeDimension = dimensions.find((match) => /<ows:Identifier>Time<\/ows:Identifier>/.test(match[1]));
  return timeDimension ? elementValue(timeDimension[1], 'Default') : undefined;
}

function legendUrl(source: string): string | undefined {
  const metadata = source.match(/<ows:Metadata[^>]*title=['"][^'"]*Color Map[^'"]*['"][^>]*>/i)?.[0];
  return metadata?.match(/xlink:href=['"]([^'"]+)['"]/i)?.[1];
}

export async function GET() {
  let xml: string;
  try {
    xml = await getCapabilitiesXml();
  } catch {
    return NextResponse.json({ status: 'error', message: 'NASA GIBS capabilities could not be reached.' }, { status: 502 });
  }
  const layers = mapLayerConfigs.map((config) => {
    const block = layerBlock(xml, config.gibsLayerId);
    const observationDate = block ? dimensionDate(block) : undefined;
    const tileMatrixSet = block?.match(/<TileMatrixSet>([^<]+)<\/TileMatrixSet>/)?.[1];
    const format = block ? elementValue(block, 'Format') : undefined;
    const gibsTitle = block ? elementValue(block, 'Title') : undefined;
    const resolutionLevel = tileMatrixSet?.match(/Level(\d+)/)?.[1];
    const wmsParameters = new URLSearchParams();
    for (const [key, value] of Object.entries({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetMap',
      LAYERS: config.gibsLayerId,
      STYLES: '',
      FORMAT: 'image/png',
      TRANSPARENT: config.sourceId === 'base' ? 'false' : 'true',
      SRS: 'EPSG:3857',
      WIDTH: '256',
      HEIGHT: '256',
      ...(observationDate ? { TIME: observationDate } : {}),
    })) {
      wmsParameters.set(key, value);
    }

    return {
      ...config,
      available: Boolean(block),
      gibsTitle,
      observationDate,
      tileMatrixSet,
      gibsTileFormat: format,
      legendUrl: block ? legendUrl(block) : undefined,
      wmsTileTemplate: `${GIBS_WMS_ENDPOINT}?${wmsParameters.toString()}&BBOX={bbox-epsg-3857}`,
      resolutionLevel: resolutionLevel ? Number(resolutionLevel) : undefined,
    };
  });

  return NextResponse.json({
    status: 'success',
    service: 'NASA EOSDIS GIBS WMTS capabilities + WMS GetMap tiles',
    capabilitiesUrl: GIBS_CAPABILITIES_URL,
    spatialProjection: 'EPSG:3857 tiles displayed on an interactive globe',
    retrievedAt: new Date().toISOString(),
    layers,
  }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
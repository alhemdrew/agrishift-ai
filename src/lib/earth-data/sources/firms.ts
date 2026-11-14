import 'server-only';

import { sourceById } from '../catalog';
import type { Observation, ObservationResult, PointQuery } from '../types';
import { UpstreamError } from '../types';
import { fetchWithTimeout } from '../fetch-with-timeout';

const source = sourceById.firms;
const citation = 'NASA FIRMS VIIRS active fire data, part of NASA LANCE/ESDIS. https://firms.modaps.eosdis.nasa.gov/';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function dateTime(date: string, time: string): string {
  const padded = time.padStart(4, '0');
  return `${date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}:00Z`;
}

export async function fetchFirmsObservations(query: PointQuery): Promise<ObservationResult> {
  const mapKey = process.env.NASA_FIRMS_MAP_KEY?.trim();
  if (!mapKey) {
    throw new UpstreamError(
      'NASA_FIRMS_MAP_KEY is not configured. Request a free FIRMS MAP_KEY and add it to the server environment.',
      503,
      'firms',
    );
  }

  const start = new Date(`${query.startDate}T00:00:00Z`);
  const end = new Date(`${query.endDate}T00:00:00Z`);
  const dayRange = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayRange < 1 || dayRange > 5) {
    throw new UpstreamError('NASA FIRMS Area API accepts a day range from 1 to 5 days per request.', 400, 'firms');
  }

  const latitudeDelta = 0.1;
  const longitudeDelta = 0.1 / Math.max(Math.cos((query.latitude * Math.PI) / 180), 0.2);
  const area = [
    query.longitude - longitudeDelta,
    query.latitude - latitudeDelta,
    query.longitude + longitudeDelta,
    query.latitude + latitudeDelta,
  ].join(',');
  const url = new URL(
    `${source.endpoint}/${encodeURIComponent(mapKey)}/VIIRS_NOAA21_NRT/${area}/${dayRange}/${query.startDate}`,
  );

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { cache: 'no-store', signal: query.signal });
  } catch {
    throw new UpstreamError('NASA FIRMS could not be reached. Check the network and retry.', 502, 'firms');
  }
  if (!response.ok) {
    throw new UpstreamError(`NASA FIRMS returned HTTP ${response.status}. Check the MAP_KEY and request limits.`, 502, 'firms');
  }

  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  if (!lines[0]?.toLowerCase().includes('latitude') || !lines[0]?.toLowerCase().includes('longitude')) {
    throw new UpstreamError('NASA FIRMS returned an unrecognized CSV response.', 502, 'firms');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows = lines.slice(1).filter(Boolean).map(parseCsvLine);
  const retrievedAt = new Date().toISOString();
  const observations: Observation[] = [];

  for (const row of rows) {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const acquisitionDate = record.acq_date || query.startDate;
    const acquisitionTime = record.acq_time || '0000';
    const observationTime = dateTime(acquisitionDate, acquisitionTime);
    const confidence = record.confidence || null;
    const commonMetadata = {
      satellite: record.satellite || null,
      instrument: record.instrument || null,
      dayNight: record.daynight || null,
      scanKm: Number(record.scan) || null,
      trackKm: Number(record.track) || null,
    };
    const qualityFlags = confidence ? [`CONFIDENCE_${confidence.toUpperCase()}`] : [];
    const rawUrl = `${source.endpoint}/[MAP_KEY]/VIIRS_NOAA21_NRT/${area}/${dayRange}/${query.startDate}`;

    for (const [variable, unit] of [['frp', 'MW'], ['brightness', 'K'], ['bright_t31', 'K']] as const) {
      const rawValue = record[variable];
      if (!rawValue || !Number.isFinite(Number(rawValue))) continue;
      const observation: Observation = {
        sourceId: 'firms',
        productId: source.productId,
        variable,
        value: Number(rawValue),
        unit,
        latitude,
        longitude,
        observationTime,
        periodStart: query.startDate,
        periodEnd: query.endDate,
        spatialResolution: source.spatialResolution,
        processingMetadata: { ...commonMetadata, confidence },
        qualityFlags,
        retrievedAt,
        provenance: rawUrl,
        citation,
      };
      observations.push(observation);
    }
  }

  return {
    sourceId: 'firms',
    productId: source.productId,
    status: observations.length ? 'success' : 'empty',
    endpoint: `${source.endpoint}/[MAP_KEY]/VIIRS_NOAA21_NRT/{west,south,east,north}/${dayRange}/${query.startDate}`,
    responseFormat: 'text/csv',
    observations,
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: source.spatialResolution,
    attribution: source.attribution,
    message: observations.length ? undefined : 'NASA FIRMS returned no active fire detections in this area and period.',
  };
}
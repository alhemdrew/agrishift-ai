import type { Observation, ObservationResult, PointQuery } from '../types';
import { UpstreamError } from '../types';
import { sourceById, POWER_PARAMETERS } from '../catalog';
import { fetchWithTimeout } from '../fetch-with-timeout';

const endpoint = sourceById.power.endpoint;
const powerCitation = 'NASA POWER Project. Daily meteorology and solar data. https://power.larc.nasa.gov/';

interface PowerResponse {
  geometry?: { coordinates?: number[] };
  header?: { fill_value?: number; time_standard?: string };
  properties?: { parameter?: Record<string, Record<string, number>> };
  parameters?: Record<string, { units?: string; longname?: string }>;
}

function apiDate(date: string): string {
  return date.replaceAll('-', '');
}

export async function fetchPowerObservations(query: PointQuery): Promise<ObservationResult> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    parameters: POWER_PARAMETERS.join(','),
    community: 'AG',
    longitude: String(query.longitude),
    latitude: String(query.latitude),
    start: apiDate(query.startDate),
    end: apiDate(query.endDate),
    'time-standard': 'UTC',
    format: 'JSON',
  }).toString();

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { cache: 'no-store', signal: query.signal });
  } catch {
    throw new UpstreamError('NASA POWER could not be reached. Check the network and retry.', 502, 'power');
  }

  if (!response.ok) {
    throw new UpstreamError(`NASA POWER returned HTTP ${response.status}.`, 502, 'power');
  }

  const body = (await response.json()) as PowerResponse;
  const parameters = body.properties?.parameter;
  if (!parameters) {
    throw new UpstreamError('NASA POWER returned an unrecognized response.', 502, 'power');
  }

  const [longitude = query.longitude, latitude = query.latitude] = body.geometry?.coordinates ?? [];
  const fillValue = body.header?.fill_value ?? -999;
  const retrievedAt = new Date().toISOString();
  const observations: Observation[] = [];

  for (const [variable, datedValues] of Object.entries(parameters)) {
    const metadata = body.parameters?.[variable];
    for (const [date, rawValue] of Object.entries(datedValues)) {
      const missing = rawValue === fillValue;
      observations.push({
        sourceId: 'power',
        productId: sourceById.power.productId,
        variable,
        value: missing || !Number.isFinite(rawValue) ? null : rawValue,
        unit: metadata?.units ?? 'unit not supplied',
        latitude,
        longitude,
        observationTime: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
        periodStart: query.startDate,
        periodEnd: query.endDate,
        spatialResolution: sourceById.power.spatialResolution,
        processingMetadata: {
          community: 'AG',
          timeStandard: body.header?.time_standard ?? 'UTC',
          fillValue,
          parameterLongName: metadata?.longname ?? null,
        },
        qualityFlags: missing ? ['NASA_POWER_FILL_VALUE'] : [],
        retrievedAt,
        provenance: `${url.origin}${url.pathname}?parameters=${POWER_PARAMETERS.join(',')}&community=AG&longitude=${query.longitude}&latitude=${query.latitude}&start=${apiDate(query.startDate)}&end=${apiDate(query.endDate)}&time-standard=UTC&format=JSON`,
        citation: powerCitation,
      });
    }
  }

  return {
    sourceId: 'power',
    productId: sourceById.power.productId,
    status: observations.some((observation) => observation.value !== null) ? 'success' : 'empty',
    endpoint: url.toString(),
    responseFormat: 'application/json',
    observations,
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.power.spatialResolution,
    attribution: sourceById.power.attribution,
    message: observations.some((observation) => observation.value !== null)
      ? undefined
      : 'NASA POWER returned no valid values for this point and period.',
  };
}
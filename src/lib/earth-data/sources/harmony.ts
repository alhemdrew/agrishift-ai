import 'server-only';

import { fromArrayBuffer } from 'geotiff';

import { sourceById } from '../catalog';
import type { Observation, PointQuery, SourceId } from '../types';
import { UpstreamError } from '../types';
import { fetchWithTimeout } from '../fetch-with-timeout';

interface HarmonyRasterQuery extends PointQuery {
  sourceId: 'gpm' | 'smap';
  collectionId: string;
  variable: string;
  productId: string;
  resolutionKm: number;
  unit: string;
}

interface HarmonyJobLink {
  rel?: string;
  href?: string;
}

interface HarmonyJob {
  status?: string;
  links?: HarmonyJobLink[];
}

export interface HarmonyPointRasterResult {
  observations: Observation[];
  processing: boolean;
  taskId?: string;
}

const harmonyOrigin = 'https://harmony.earthdata.nasa.gov';

function dateTime(date: string, endOfDay = false): string {
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

function observationTimeFromHref(href: string, query: PointQuery): string {
  const timestamp = href.match(/(20\d{6})T(\d{6})/);
  if (timestamp) {
    const [, date, time] = timestamp;
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
  }

  const date = href.match(/20\d{6}/)?.[0];
  if (date) return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  return query.startDate === query.endDate ? query.startDate : `${query.startDate}/${query.endDate}`;
}

function observationIsInRange(observationTime: string, query: PointQuery): boolean {
  const timestamp = Date.parse(observationTime);
  if (!Number.isFinite(timestamp)) return true;

  const start = Date.parse(`${query.startDate}T00:00:00Z`);
  const end = Date.parse(`${query.endDate}T23:59:59.999Z`);
  return timestamp >= start && timestamp <= end;
}

async function throwHarmonyResponseError(response: Response, sourceId: 'gpm' | 'smap'): Promise<never> {
  const upstreamStatus = response.status;
  let description = '';
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = (await response.json()) as { description?: unknown };
      description = typeof body.description === 'string' ? body.description : '';
    } catch {
      await response.body?.cancel();
    }
  } else {
    await response.body?.cancel();
  }

  const dataServiceStatus = description.match(/\b(401|403|404|429|5\d\d)\s+error retrieving\b/i)?.[1];
  if (dataServiceStatus) {
    const agreementRequired = sourceId === 'gpm' && dataServiceStatus === '403';
    const reason = agreementRequired
      ? ' GES DISC direct access confirmed HTTP 403: EULA Acceptance Failure. Accept the GES DISC data-use agreement for this Earthdata account and retry.'
      : '';
    throw new UpstreamError(
      `NASA Harmony returned HTTP ${upstreamStatus}; its upstream data service returned HTTP ${dataServiceStatus}.${reason}`,
      agreementRequired ? 403 : 502,
      sourceId,
      agreementRequired ? 'agreement_required' : undefined,
    );
  }

  throw new UpstreamError(`NASA Harmony returned HTTP ${upstreamStatus}.`, 502, sourceId);
}

function throwAuthorizationError(status: number, sourceId: 'gpm' | 'smap'): never {
  throw new UpstreamError(
    `NASA Harmony returned HTTP ${status}; Earthdata authorization was rejected or redirected to login. Check token validity and collection permissions.`,
    503,
    sourceId,
  );
}

async function observationsFromTiff(
  arrayBuffer: ArrayBuffer,
  query: HarmonyRasterQuery,
  href: string,
): Promise<Observation[]> {
  let tiff;
  try {
    tiff = await fromArrayBuffer(arrayBuffer);
  } catch {
    throw new UpstreamError('NASA Harmony returned a GeoTIFF that could not be decoded.', 502, query.sourceId);
  }

  const retrievedAt = new Date().toISOString();
  const observations: Observation[] = [];
  const imageCount = await tiff.getImageCount();

  for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const image = await tiff.getImage(imageIndex);
    const raster = await image.readRasters({ interleave: true });
    const rawValue = Number(raster[0]);
    const noDataValue = image.getGDALNoData();
    const missing = !Number.isFinite(rawValue) || (noDataValue !== null && rawValue === Number(noDataValue));
    const description = String(image.getFileDirectory().ImageDescription ?? '').slice(0, 300);
    const observationTime = observationTimeFromHref(href, query);
    if (!observationIsInRange(observationTime, query)) continue;

    observations.push({
      sourceId: query.sourceId,
      productId: query.productId,
      variable: query.variable,
      value: missing ? null : rawValue,
      unit: query.unit,
      latitude: query.latitude,
      longitude: query.longitude,
      observationTime,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      spatialResolution: sourceById[query.sourceId].spatialResolution,
      processingMetadata: {
        spatialSubset: 'point-centered subset returned by NASA Harmony',
        sourceRasterDescription: description || null,
        outputImageIndex: imageIndex,
        noDataValue: noDataValue === null ? null : Number(noDataValue),
      },
      qualityFlags: missing ? ['SOURCE_NODATA'] : [],
      retrievedAt,
      provenance: `${harmonyOrigin}/${query.collectionId}/ogc-api-coverages/1.0.0/collections/${encodeURIComponent(query.variable)}/coverage/rangeset`,
      citation: sourceById[query.sourceId].attribution,
    });
  }

  return observations;
}

async function fetchJobObservations(
  jobId: string,
  query: HarmonyRasterQuery,
  token: string,
): Promise<HarmonyPointRasterResult> {
  const jobUrl = new URL(`/jobs/${encodeURIComponent(jobId)}`, harmonyOrigin);
  let response: Response;
  try {
    response = await fetchWithTimeout(jobUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    throw new UpstreamError('NASA Harmony job status could not be retrieved. Retry the request.', 502, query.sourceId);
  }

  if ([401, 403, 302, 303].includes(response.status)) throwAuthorizationError(response.status, query.sourceId);
  if (!response.ok) return throwHarmonyResponseError(response, query.sourceId);

  let job: HarmonyJob;
  try {
    job = (await response.json()) as HarmonyJob;
  } catch {
    throw new UpstreamError('NASA Harmony returned an invalid job status response.', 502, query.sourceId);
  }

  const status = job.status?.toLowerCase();
  if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
    throw new UpstreamError('NASA Harmony failed to process the requested point subset.', 502, query.sourceId);
  }
  if (!['successful', 'complete', 'completed'].includes(status ?? '')) {
    return {
      observations: [],
      processing: true,
      taskId: jobId,
    };
  }

  const dataLinks = (job.links ?? []).filter((link) => link.rel === 'data' && typeof link.href === 'string');
  const observations: Observation[] = [];
  for (const link of dataLinks) {
    const dataUrl = new URL(link.href!, jobUrl);
    if (dataUrl.origin !== harmonyOrigin) {
      throw new UpstreamError('NASA Harmony returned an unexpected data location.', 502, query.sourceId);
    }

    let dataResponse: Response;
    try {
      dataResponse = await fetchWithTimeout(dataUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'image/tiff' },
        redirect: 'follow',
        cache: 'no-store',
      });
    } catch {
      throw new UpstreamError('NASA Harmony result data could not be downloaded. Retry the request.', 502, query.sourceId);
    }

    if ([401, 403].includes(dataResponse.status)) throwAuthorizationError(dataResponse.status, query.sourceId);
    if (!dataResponse.ok) return throwHarmonyResponseError(dataResponse, query.sourceId);
    if (!dataResponse.headers.get('content-type')?.toLowerCase().includes('tiff')) {
      await dataResponse.body?.cancel();
      throw new UpstreamError('NASA Harmony returned a non-GeoTIFF result file.', 502, query.sourceId);
    }

    observations.push(...await observationsFromTiff(await dataResponse.arrayBuffer(), query, link.href!));
  }

  return { observations, processing: false };
}

export async function fetchHarmonyPointRaster(
  query: HarmonyRasterQuery,
  existingTaskId?: string,
): Promise<HarmonyPointRasterResult> {
  const token = process.env.NASA_EARTHDATA_TOKEN?.trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new UpstreamError(
      'NASA_EARTHDATA_TOKEN is not configured. Add a NASA Earthdata Login bearer token to the server environment.',
      503,
      query.sourceId,
    );
  }

  if (existingTaskId) {
    if (!/^[\da-f-]{36}$/i.test(existingTaskId)) {
      throw new UpstreamError('NASA Harmony job identifier is invalid.', 400, query.sourceId);
    }
    return fetchJobObservations(existingTaskId, query, token);
  }

  const latitudeRadius = query.resolutionKm / 111;
  const longitudeRadius = latitudeRadius / Math.max(Math.cos((query.latitude * Math.PI) / 180), 0.2);
  const bounds = {
    west: query.longitude - longitudeRadius / 2,
    east: query.longitude + longitudeRadius / 2,
    south: query.latitude - latitudeRadius / 2,
    north: query.latitude + latitudeRadius / 2,
  };
  const base = `https://harmony.earthdata.nasa.gov/${query.collectionId}/ogc-api-coverages/1.0.0`;
  const url = new URL(`${base}/collections/${encodeURIComponent(query.variable)}/coverage/rangeset`);
  url.searchParams.append('subset', `lon(${bounds.west}:${bounds.east})`);
  url.searchParams.append('subset', `lat(${bounds.south}:${bounds.north})`);
  url.searchParams.append('subset', `time("${dateTime(query.startDate)}":"${dateTime(query.endDate, true)}")`);
  url.searchParams.set('width', '1');
  url.searchParams.set('height', '1');
  url.searchParams.set('format', 'image/tiff');

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'image/tiff' },
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    throw new UpstreamError('NASA Harmony could not be reached. Check the network and retry.', 502, query.sourceId);
  }

  if ([302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (location) {
      const redirectUrl = new URL(location, url);
      if (redirectUrl.origin === harmonyOrigin) {
        const jobId = redirectUrl.pathname.match(/^\/jobs\/([\da-f-]{36})$/i)?.[1];
        if (jobId) return fetchJobObservations(jobId, query, token);
      }
    }
    throwAuthorizationError(response.status, query.sourceId);
  }

  if (!response.ok) return throwHarmonyResponseError(response, query.sourceId);
  if (!response.headers.get('content-type')?.toLowerCase().includes('tiff')) {
    await response.body?.cancel();
    throw new UpstreamError('NASA Harmony returned a non-GeoTIFF response for the point subset.', 502, query.sourceId);
  }

  return {
    observations: await observationsFromTiff(await response.arrayBuffer(), query, url.pathname),
    processing: false,
  };
}

export function harmonySourceId(sourceId: SourceId): sourceId is 'gpm' | 'smap' {
  return sourceId === 'gpm' || sourceId === 'smap';
}

import 'server-only';

import { gunzipSync } from 'node:zlib';
import { fromArrayBuffer } from 'geotiff';

import type { Observation, ObservationResult, PointQuery } from '../types';
import { UpstreamError } from '../types';
import { sourceById } from '../catalog';
import { fetchWithTimeout } from '../fetch-with-timeout';

const archiveRoot = 'https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05';
const citation = 'Climate Hazards Center, UC Santa Barbara. CHIRPS v2.0 daily precipitation. https://www.chc.ucsb.edu/data/chirps';
const noDataFallback = -9999;

function coordinatePair(values: readonly number[], label: string): [number, number] {
  const [first, second] = values;
  if (typeof first !== 'number' || typeof second !== 'number') {
    throw new UpstreamError(`CHIRPS returned an invalid ${label}.`, 502, 'chirps');
  }
  return [first, second];
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function archiveUrl(date: string): string {
  const [year, month] = date.split('-');
  return `${archiveRoot}/${year}/${month}/chirps-v2.0.${date.replaceAll('-', '.')}.tif.gz`;
}

export function observationFromRasterValue(
  raster: number,
  query: PointQuery,
  origin: [number, number],
  resolution: [number, number],
  width: number,
  height: number,
  noData: number,
): Observation | null {
  const [originX, originY] = origin;
  const [resolutionX, resolutionY] = resolution;
  const column = Math.floor((query.longitude - originX) / resolutionX);
  const row = Math.floor((originY - query.latitude) / Math.abs(resolutionY));
  if (column < 0 || column >= width || row < 0 || row >= height) return null;

  const missing = !Number.isFinite(raster) || raster === noData || raster === noDataFallback;
  return {
    sourceId: 'chirps',
    productId: sourceById.chirps.productId,
    variable: 'precipitation',
    value: missing ? null : raster,
    unit: 'mm/day',
    latitude: query.latitude,
    longitude: query.longitude,
    observationTime: query.startDate,
    periodStart: query.startDate,
    periodEnd: query.endDate,
    spatialResolution: sourceById.chirps.spatialResolution,
    processingMetadata: {
      coordinateReferenceSystem: 'EPSG:4326',
      sampling: 'containing-cell',
      rasterColumn: column,
      rasterRow: row,
      noDataValue: noData,
    },
    qualityFlags: missing ? ['CHIRPS_NODATA'] : [],
    retrievedAt: new Date().toISOString(),
    provenance: archiveUrl(query.startDate),
    citation,
  };
}

export async function observationsFromChirpsGeoTiff(
  arrayBuffer: ArrayBuffer,
  query: PointQuery,
  observationDate: string,
  provenance: string,
): Promise<Observation[]> {
  let tiff;
  try {
    tiff = await fromArrayBuffer(arrayBuffer);
  } catch {
    throw new UpstreamError('CHIRPS returned a GeoTIFF that could not be decoded.', 502, 'chirps');
  }

  const image = await tiff.getImage();
  const origin = coordinatePair(image.getOrigin(), 'raster origin');
  const resolution = coordinatePair(image.getResolution(), 'raster resolution');
  const width = image.getWidth();
  const height = image.getHeight();
  const noData = Number(image.getGDALNoData() ?? noDataFallback);
  const raster = await image.readRasters({ interleave: true });
  const column = Math.floor((query.longitude - origin[0]) / resolution[0]);
  const row = Math.floor((origin[1] - query.latitude) / Math.abs(resolution[1]));
  if (column < 0 || column >= width || row < 0 || row >= height) return [];

  const value = Number(raster[row * width + column]);
  const observation = observationFromRasterValue(value, { ...query, startDate: observationDate }, origin, resolution, width, height, noData);
  if (!observation) return [];
  observation.provenance = provenance;
  observation.observationTime = observationDate;
  observation.periodStart = observationDate;
  observation.periodEnd = observationDate;
  return [observation];
}

async function fetchDate(date: string, query: PointQuery): Promise<Observation[]> {
  const url = archiveUrl(date);
  let response: Response;
  try {
    response = await fetchWithTimeout(url, { cache: 'no-store', signal: query.signal });
  } catch {
    throw new UpstreamError('CHIRPS could not be reached. Check the network and retry.', 502, 'chirps');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpstreamError(`CHIRPS returned HTTP ${response.status} for ${date}.`, 502, 'chirps');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let data: ArrayBuffer;
  try {
    const decompressed = gunzipSync(bytes);
    data = new Uint8Array(decompressed).buffer;
  } catch {
    throw new UpstreamError('CHIRPS returned an invalid gzip raster.', 502, 'chirps');
  }
  return observationsFromChirpsGeoTiff(data, query, date, url);
}

export async function fetchChirpsObservations(query: PointQuery): Promise<ObservationResult> {
  const dates = datesBetween(query.startDate, query.endDate);
  const results: PromiseSettledResult<Observation[]>[] = new Array(dates.length);
  let nextDateIndex = 0;
  const concurrency = Math.min(3, dates.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextDateIndex < dates.length && !query.signal?.aborted) {
      const index = nextDateIndex++;
      try {
        results[index] = { status: 'fulfilled', value: await fetchDate(dates[index], query) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }));
  if (query.signal?.aborted) {
    throw new UpstreamError('CHIRPS retrieval exceeded the source time budget.', 504, 'chirps', 'timeout');
  }
  const observations = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const failures = results.filter((result) => result.status === 'rejected');

  if (observations.length === 0 && failures.length === results.length) {
    const firstFailure = failures[0];
    if (firstFailure?.status === 'rejected' && firstFailure.reason instanceof UpstreamError) {
      throw firstFailure.reason;
    }
    throw new UpstreamError('CHIRPS did not return usable raster observations.', 502, 'chirps');
  }

  return {
    sourceId: 'chirps',
    productId: sourceById.chirps.productId,
    status: observations.some((observation) => observation.value !== null) ? 'success' : 'empty',
    endpoint: archiveRoot,
    responseFormat: 'application/gzip GeoTIFF',
    observations,
    retrievedAt: new Date().toISOString(),
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.chirps.spatialResolution,
    attribution: sourceById.chirps.attribution,
    message: observations.length > 0
      ? undefined
      : 'CHIRPS returned no valid pixel for this location and period.',
  };
}

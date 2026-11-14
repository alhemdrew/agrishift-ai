import 'server-only';

import { sourceById } from '../catalog';
import type { Observation, ObservationResult, PointQuery } from '../types';
import { UpstreamError } from '../types';
import { fetchWithTimeout } from '../fetch-with-timeout';

const api = sourceById.modis.endpoint;
const product = sourceById.modis.productId;
const citation = 'Didan, K. (2021). MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. NASA LP DAAC. https://doi.org/10.5067/MODIS/MOD13Q1.061';

interface AppeearsTask {
  task_id?: string;
  status?: string;
  task_name?: string;
}

interface AppeearsFile {
  file_id?: string;
  file_name?: string;
  file_type?: string;
}

interface AppeearsTokenResponse {
  token?: string;
  token_type?: string;
  expiration?: string;
}

interface CachedAppeearsToken {
  token: string;
  expiresAt: number;
}

const tokenRefreshSkewMs = 5 * 60 * 1000;
const fallbackTokenLifetimeMs = 47 * 60 * 60 * 1000;
let cachedAppeearsToken: CachedAppeearsToken | undefined;
let appeearsLoginInFlight: Promise<string> | undefined;

function appeearsDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${month}-${day}-${year}`;
}

function csvRow(line: string): string[] {
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

function observationDate(value: string): string {
  const trimmed = value.trim();
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new UpstreamError('NASA AppEEARS CSV included an invalid observation date.', 502, 'modis');
  }
  return parsed.toISOString().slice(0, 10);
}

async function getAppeearsToken(): Promise<string> {
  const username = process.env.NASA_EARTHDATA_USERNAME?.trim();
  const password = process.env.NASA_EARTHDATA_PASSWORD;
  if (!username?.trim() || !password) {
    throw new UpstreamError(
      'NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD are not configured. AppEEARS requires an Earthdata username/password exchange; NASA_EARTHDATA_TOKEN alone is not sufficient.',
      503,
      'modis',
    );
  }

  if (cachedAppeearsToken && cachedAppeearsToken.expiresAt - tokenRefreshSkewMs > Date.now()) {
    return cachedAppeearsToken.token;
  }

  if (appeearsLoginInFlight) return appeearsLoginInFlight;

  appeearsLoginInFlight = (async () => {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${api}/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        Accept: 'application/json',
      },
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    throw new UpstreamError('NASA AppEEARS login could not be reached. Check the network and retry.', 502, 'modis');
  }

  if (!response.ok) {
    await response.body?.cancel();
    const status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw new UpstreamError(`NASA AppEEARS login returned HTTP ${response.status}.`, status, 'modis');
  }

  let result: AppeearsTokenResponse;
  try {
    result = (await response.json()) as AppeearsTokenResponse;
  } catch {
    throw new UpstreamError('NASA AppEEARS returned an invalid login response.', 502, 'modis');
  }
  if (!result.token || (result.token_type && result.token_type.toLowerCase() !== 'bearer')) {
    throw new UpstreamError('NASA AppEEARS did not return an access token.', 502, 'modis');
  }

  const expiresAt = result.expiration ? Date.parse(result.expiration) : Date.now() + fallbackTokenLifetimeMs;
  if (!Number.isFinite(expiresAt) || expiresAt - tokenRefreshSkewMs <= Date.now()) {
    throw new UpstreamError('NASA AppEEARS returned an expired or invalid token expiration.', 502, 'modis');
  }

  cachedAppeearsToken = { token: result.token, expiresAt };
  return result.token;
  })().finally(() => {
  appeearsLoginInFlight = undefined;
  });

  return appeearsLoginInFlight;
}

async function fetchAppeears(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
  const token = await getAppeearsToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { ...init, headers, redirect: 'manual', cache: 'no-store' });
  } catch {
    throw new UpstreamError('NASA AppEEARS could not be reached. Check the network and retry.', 502, 'modis');
  }

  const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
  const isBundleFile = pathSegments.at(-3) === 'bundle' && pathSegments.length >= 4;
  if (isBundleFile && [301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) {
      throw new UpstreamError('NASA AppEEARS result download returned a redirect without a location.', 502, 'modis');
    }

    const downloadUrl = new URL(location, url);
    if (downloadUrl.protocol !== 'https:' || downloadUrl.username || downloadUrl.password) {
      throw new UpstreamError('NASA AppEEARS returned an invalid result download location.', 502, 'modis');
    }

    const downloadHeaders = new Headers({ Accept: 'text/csv' });
    if (downloadUrl.origin === new URL(api).origin) {
      downloadHeaders.set('Authorization', `Bearer ${token}`);
    }

    try {
      return await fetchWithTimeout(downloadUrl, {
        headers: downloadHeaders,
        redirect: 'follow',
        cache: 'no-store',
      });
    } catch {
      throw new UpstreamError('NASA AppEEARS result file could not be downloaded. Retry the request.', 502, 'modis');
    }
  }

  if (response.status !== 403 || attempt === 1) return response;
  await response.body?.cancel();
  if (cachedAppeearsToken?.token === token) cachedAppeearsToken = undefined;
  }

  throw new UpstreamError('NASA AppEEARS authorization failed after refreshing its access token.', 503, 'modis');
}

async function throwAppeearsResponseError(response: Response, action: string): Promise<never> {
  await response.body?.cancel();
  const credentialsRejected = [401, 403, 302, 303].includes(response.status);
  const hint = credentialsRejected ? ' Check Earthdata credentials and AppEEARS access.' : '';
  throw new UpstreamError(
    `NASA AppEEARS ${action} returned HTTP ${response.status}.${hint}`,
    credentialsRejected ? 503 : 502,
    'modis',
  );
}

function taskResult(task: AppeearsTask, query: PointQuery): ObservationResult {
  const retrievedAt = new Date().toISOString();
  return {
    sourceId: 'modis',
    productId: product,
    status: 'processing',
    endpoint: `${api}/task`,
    responseFormat: 'AppEEARS asynchronous point task',
    observations: [],
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.modis.spatialResolution,
    attribution: sourceById.modis.attribution,
    message: 'NASA AppEEARS is processing the MODIS point sample.',
    taskId: task.task_id,
  };
}

function observationsFromCsv(csv: string, query: PointQuery, provenance: string): Observation[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = csvRow(lines[0]).map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const dateIndex = normalizedHeaders.findIndex((header) => header === 'date' || header.includes('date'));
  const ndviIndex = normalizedHeaders.findIndex((header) => header.includes('ndvi'));
  const eviIndex = normalizedHeaders.findIndex((header) => header.includes('evi') && !header.includes('quality'));
  const qualityIndex = normalizedHeaders.findIndex((header) => header.includes('vi quality'));
  const reliabilityIndex = normalizedHeaders.findIndex((header) => header.includes('pixel reliability'));
  if (dateIndex < 0) {
    throw new UpstreamError('NASA AppEEARS CSV did not include an observation date column.', 502, 'modis');
  }
  if (ndviIndex < 0 && eviIndex < 0) {
    throw new UpstreamError('NASA AppEEARS CSV did not include NDVI or EVI columns.', 502, 'modis');
  }

  const retrievedAt = new Date().toISOString();
  const result: Observation[] = [];
  for (const line of lines.slice(1)) {
    const values = csvRow(line);
    const rawDate = values[dateIndex];
    if (!rawDate) throw new UpstreamError('NASA AppEEARS CSV included a row without an observation date.', 502, 'modis');
    const date = observationDate(rawDate);
    if (date < query.startDate || date > query.endDate) continue;
    const quality = qualityIndex >= 0 ? values[qualityIndex] : undefined;
    const reliability = reliabilityIndex >= 0 ? values[reliabilityIndex] : undefined;
    const qualityFlags = [
      quality ? `VI_QUALITY_${quality}` : null,
      reliability ? `PIXEL_RELIABILITY_${reliability}` : null,
    ].filter((flag): flag is string => Boolean(flag));

    for (const [variable, index] of [['NDVI', ndviIndex], ['EVI', eviIndex]] as const) {
      if (index < 0 || !values[index]) continue;
      const appeearsValue = Number(values[index]);
      const isFill = appeearsValue === -3000 || appeearsValue === -0.3;
      const isInvalid = !Number.isFinite(appeearsValue) || appeearsValue < -0.2 || appeearsValue > 1;
      result.push({
        sourceId: 'modis',
        productId: product,
        variable,
        value: isInvalid ? null : appeearsValue,
        unit: 'unitless',
        latitude: query.latitude,
        longitude: query.longitude,
        observationTime: date,
        periodStart: query.startDate,
        periodEnd: query.endDate,
        spatialResolution: sourceById.modis.spatialResolution,
        processingMetadata: {
          rawValue: Number.isFinite(appeearsValue) ? appeearsValue : null,
          scaleFactor: 0.0001,
          scaleAppliedBy: 'NASA AppEEARS point-sample output',
          fillValue: -3000,
          appeearsFillValue: -0.3,
          viQuality: quality ?? null,
          pixelReliability: reliability ?? null,
        },
        qualityFlags: isFill
          ? [...qualityFlags, 'MODIS_FILL_VALUE']
          : isInvalid
            ? [...qualityFlags, 'MODIS_INVALID_VALUE']
            : qualityFlags,
        retrievedAt,
        provenance,
        citation,
      });
    }
  }
  return result;
}

export async function fetchModisObservations(
  query: PointQuery,
  existingTaskId?: string,
): Promise<ObservationResult> {
  const token = await getAppeearsToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  let taskId = existingTaskId;

  if (!taskId) {
    const taskBody = {
      task_type: 'point',
      task_name: `agrishif-modis-${Date.now()}`,
      params: {
        dates: [{ startDate: appeearsDate(query.startDate), endDate: appeearsDate(query.endDate) }],
        layers: [
          { product, layer: '_250m_16_days_NDVI' },
          { product, layer: '_250m_16_days_EVI' },
          { product, layer: '_250m_16_days_VI_Quality' },
          { product, layer: '_250m_16_days_pixel_reliability' },
        ],
        coordinates: [{ id: 'selected-location', latitude: query.latitude, longitude: query.longitude }],
      },
    };
    const response = await fetchAppeears(`${api}/task`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(taskBody),
      cache: 'no-store',
    });
    if (!response.ok) {
      return throwAppeearsResponseError(response, 'task submission');
    }
    const task = (await response.json()) as AppeearsTask;
    taskId = task.task_id;
    if (!taskId) throw new UpstreamError('NASA AppEEARS did not return a task identifier.', 502, 'modis');
    return taskResult({ ...task, task_id: taskId }, query);
  }

  const statusResponse = await fetchAppeears(`${api}/task/${encodeURIComponent(taskId)}`, { headers });
  if (!statusResponse.ok) {
    return throwAppeearsResponseError(statusResponse, 'task status');
  }
  const task = (await statusResponse.json()) as AppeearsTask;
  if (task.status && !['done', 'complete', 'completed'].includes(task.status.toLowerCase())) {
    if (['error', 'failed'].includes(task.status.toLowerCase())) {
      throw new UpstreamError('NASA AppEEARS processing failed for the MODIS point sample.', 502, 'modis');
    }
    return taskResult({ ...task, task_id: taskId }, query);
  }

  const bundleResponse = await fetchAppeears(`${api}/bundle/${encodeURIComponent(taskId)}`, { headers });
  if (!bundleResponse.ok) {
    return throwAppeearsResponseError(bundleResponse, 'bundle listing');
  }
  const bundle = (await bundleResponse.json()) as { files?: AppeearsFile[] } | AppeearsFile[];
  const files = Array.isArray(bundle) ? bundle : bundle.files ?? [];
  const csvFiles = files.filter((file) => file.file_name?.toLowerCase().endsWith('.csv'));
  const observations: Observation[] = [];
  for (const file of csvFiles) {
    const fileId = file.file_id ?? file.file_name;
    if (!fileId) continue;
    const fileUrl = `${api}/bundle/${encodeURIComponent(taskId)}/${encodeURIComponent(fileId)}`;
    const fileResponse = await fetchAppeears(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!fileResponse.ok) {
      return throwAppeearsResponseError(fileResponse, 'result download');
    }
    observations.push(...observationsFromCsv(await fileResponse.text(), query, fileUrl));
  }

  const retrievedAt = new Date().toISOString();
  return {
    sourceId: 'modis',
    productId: product,
    status: observations.some((observation) => observation.value !== null) ? 'success' : 'empty',
    endpoint: `${api}/bundle/${taskId}`,
    responseFormat: 'text/csv',
    observations,
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.modis.spatialResolution,
    attribution: sourceById.modis.attribution,
    message: observations.some((observation) => observation.value !== null)
      ? undefined
      : 'NASA AppEEARS completed without a valid NDVI/EVI sample for this point and period.',
  };
}
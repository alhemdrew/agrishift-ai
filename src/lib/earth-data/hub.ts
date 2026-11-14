import { sourceById } from './catalog';
import { fetchChirpsObservations } from './sources/chirps';
import { fetchFirmsObservations } from './sources/firms';
import { fetchGpmObservations } from './sources/gpm';
import { fetchModisObservations } from './sources/modis';
import { fetchPowerObservations } from './sources/power';
import { fetchSmapObservations } from './sources/smap';
import { fetchSoilgridsObservations } from './sources/soilgrids';
import type {
  ObservationHubResult,
  ObservationResult,
  PointQuery,
  SourceAvailability,
  SourceHubEntry,
  SourceId,
  ProviderDiagnostic,
} from './types';
import { UpstreamError } from './types';

const sourceIds: SourceId[] = ['power', 'gpm', 'smap', 'modis', 'firms', 'soilgrids', 'chirps'];
const sourceDeadlineMs = Math.min(
  20_000,
  Math.max(5_000, Number.parseInt(process.env.EARTH_DATA_SOURCE_DEADLINE_MS ?? '', 10) || 8_000),
);
const lastSuccessfulRetrievals: Partial<Record<SourceId, string>> = {};

async function fetchSource(
  sourceId: SourceId,
  query: PointQuery,
  taskId?: string,
  smapVariable: 'surface' | 'rootzone' = 'surface',
): Promise<ObservationResult> {
  switch (sourceId) {
    case 'power':
      return fetchPowerObservations(query);
    case 'gpm':
      return fetchGpmObservations(query, taskId);
    case 'smap':
      return fetchSmapObservations(query, smapVariable, taskId);
    case 'modis':
      return fetchModisObservations(query, taskId);
    case 'firms':
      return fetchFirmsObservations(query);
    case 'soilgrids':
      return fetchSoilgridsObservations(query);
    case 'chirps':
      return fetchChirpsObservations(query);
  }
}

function availabilityFor(result: ObservationResult): SourceAvailability {
  if (result.observations.some(observationHasValue)) return 'operational';
  return 'partially_operational';
}

function observationHasValue(observation: ObservationResult['observations'][number]): boolean {
  return typeof observation.value === 'number'
    ? Number.isFinite(observation.value)
    : typeof observation.value === 'string' && observation.value.trim().length > 0;
}

function deduplicateObservations(result: ObservationResult): ObservationResult {
  const seen = new Set<string>();
  const observations = result.observations.filter((observation) => {
    const key = JSON.stringify([
      observation.sourceId,
      observation.productId,
      observation.variable,
      observation.value,
      observation.unit,
      observation.latitude,
      observation.longitude,
      observation.observationTime,
      observation.qualityFlags ?? [],
      observation.processingMetadata,
      observation.provenance,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return observations.length === result.observations.length ? result : { ...result, observations };
}

function diagnosticFor(sourceId: SourceId, entry: SourceHubEntry): ProviderDiagnostic {
  const result = entry.result;
  const observations = result?.observations ?? [];
  const validObservations = observations.filter(observationHasValue);
  const latestObservationTime = validObservations
    .map((observation) => observation.observationTime)
    .sort()
    .at(-1) ?? null;
  const errorStatus = entry.error?.status;
  const errorText = entry.error?.message ?? '';
  const errorCategory: ProviderDiagnostic['errorCategory'] =
    entry.status === 'credentials_required' ? 'credentials'
      : entry.status === 'agreement_required' ? 'agreement'
        : errorStatus === 429 || /HTTP 429/.test(errorText) ? 'rate_limit'
          : /HTTP (401|403)/.test(errorText) ? 'credentials'
          : errorStatus === 400 || /HTTP 400/.test(errorText) ? 'request'
          : entry.status === 'timeout' || errorStatus === 504 ? 'timeout'
            : entry.status === 'empty' ? 'empty'
              : entry.status === 'error' ? 'provider'
                : null;
  const status: ProviderDiagnostic['status'] =
    entry.status === 'processing' ? 'pending'
      : entry.status === 'credentials_required' || entry.status === 'agreement_required' ? 'not_configured'
        : entry.status === 'success' && entry.availability === 'operational' ? 'healthy'
          : entry.status === 'empty' && sourceId === 'firms' ? 'healthy'
            : entry.status === 'success' || entry.status === 'timeout' || errorStatus === 429 || /HTTP 429/.test(errorText) ? 'degraded'
              : entry.status === 'empty' ? 'degraded'
              : 'unavailable';

  const message = status === 'healthy' && validObservations.length === 0
    ? result?.message ?? 'Provider retrieval succeeded; no observations were returned for this query.'
    : status === 'pending'
      ? result?.message ?? 'Provider processing is still pending.'
      : status === 'not_configured'
        ? entry.error?.message ?? 'Provider credentials or data-use agreement are required.'
        : status === 'degraded'
          ? errorCategory === 'timeout' ? 'Provider exceeded its retrieval time budget.'
            : errorCategory === 'rate_limit' ? 'Provider rate limit reached.'
              : errorCategory === 'empty' ? entry.error?.message ?? result?.message ?? 'Provider returned no valid observations for this query.'
              : 'Provider returned partial or incomplete data.'
          : status === 'unavailable'
            ? entry.error?.message ?? 'Provider data could not be retrieved for this request.'
            : 'Genuine provider observations retrieved.';

  return {
    providerName: sourceById[sourceId].name,
    status,
    lastSuccessfulRetrieval: result && ['success', 'empty'].includes(result.status)
      ? (lastSuccessfulRetrievals[sourceId] = result.retrievedAt)
      : lastSuccessfulRetrievals[sourceId] ?? null,
    latestObservationTime,
    observationPeriod: result?.period ?? null,
    taskId: result?.taskId ?? null,
    observationCount: observations.filter(observationHasValue).length,
    latestObservations: validObservations
      .filter((observation): observation is typeof observation & { value: number | string } => observation.value !== null)
      .sort((a, b) => b.observationTime.localeCompare(a.observationTime))
      .slice(0, 3)
      .map(({ variable, value, unit, observationTime }) => ({ variable, value, unit, observationTime })),
    attribution: result?.attribution ?? sourceById[sourceId].attribution,
    retrievalDurationMs: entry.durationMs ?? null,
    errorCategory,
    message,
    dataOrigin: observations.some(observationHasValue) ? 'genuine_provider' : 'none',
  };
}

function queryForSource(sourceId: SourceId, query: PointQuery): PointQuery {
  if (sourceId !== 'firms') return query;
  const end = Date.parse(`${query.endDate}T00:00:00Z`);
  const start = Date.parse(`${query.startDate}T00:00:00Z`);
  const requestedDays = Math.floor((end - start) / 86_400_000) + 1;
  if (requestedDays <= 5) return query;
  const limitedStart = new Date(end);
  limitedStart.setUTCDate(limitedStart.getUTCDate() - 4);
  return { ...query, startDate: limitedStart.toISOString().slice(0, 10) };
}

async function fetchSourceEntry(
  sourceId: SourceId,
  query: PointQuery,
  taskId?: string,
  smapVariable: 'surface' | 'rootzone' = 'surface',
): Promise<SourceHubEntry> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let deadlineTimer: ReturnType<typeof setTimeout>;
  try {
    const result = deduplicateObservations(await Promise.race([
      fetchSource(sourceId, { ...queryForSource(sourceId, query), signal: controller.signal }, taskId, smapVariable),
      new Promise<never>((_, reject) => {
        deadlineTimer = setTimeout(() => {
          controller.abort();
          reject(new UpstreamError(
            `${sourceById[sourceId].name} did not respond within the source time budget.`,
            504,
            sourceId,
            'timeout',
          ));
        }, sourceDeadlineMs);
      }),
    ]));
    return {
      sourceId,
      availability: availabilityFor(result),
      status: result.status,
      durationMs: Date.now() - startedAt,
      result,
    };
  } catch (error) {
    if (error instanceof UpstreamError) {
      return {
        sourceId,
        availability: 'unavailable',
        status: error.retrievalStatus ?? (error.httpStatus === 503 ? 'credentials_required' : 'error'),
        durationMs: Date.now() - startedAt,
        error: { status: error.httpStatus, message: error.message },
      };
    }

    return {
      sourceId,
      availability: 'unavailable',
      status: 'error',
      durationMs: Date.now() - startedAt,
      error: { status: 500, message: `Unexpected error while retrieving NASA ${sourceById[sourceId].name} data.` },
    };
  } finally {
    clearTimeout(deadlineTimer!);
  }
}

export async function fetchObservationSource(
  sourceId: SourceId,
  query: PointQuery,
  taskId?: string,
  smapVariable: 'surface' | 'rootzone' = 'surface',
): Promise<ObservationResult> {
  const entry = await fetchSourceEntry(sourceId, query, taskId, smapVariable);
  if (entry.result) return entry.result;
  throw new UpstreamError(
    entry.error?.message ?? `${sourceById[sourceId].name} did not return a result.`,
    entry.error?.status ?? 502,
    sourceId,
    entry.status,
  );
}

export async function fetchObservationHub(
  query: PointQuery,
  taskIds?: Partial<Record<SourceId, string>>,
): Promise<ObservationHubResult> {
  const startedAt = Date.now();
  const entries = await Promise.all(
    sourceIds.map((sourceId) => fetchSourceEntry(sourceId, query, taskIds?.[sourceId])),
  );
  const sources = Object.fromEntries(entries.map((entry) => [
    entry.sourceId,
    { ...entry, diagnostic: diagnosticFor(entry.sourceId, entry) },
  ])) as Record<SourceId, SourceHubEntry>;

  return {
    retrievedAt: new Date().toISOString(),
    period: { start: query.startDate, end: query.endDate },
    durationMs: Date.now() - startedAt,
    sources,
  };
}

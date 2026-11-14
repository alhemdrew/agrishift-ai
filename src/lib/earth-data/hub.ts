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
} from './types';
import { UpstreamError } from './types';

const sourceIds: SourceId[] = ['power', 'gpm', 'smap', 'modis', 'firms', 'soilgrids', 'chirps'];
const sourceDeadlineMs = Math.min(
  20_000,
  Math.max(5_000, Number.parseInt(process.env.EARTH_DATA_SOURCE_DEADLINE_MS ?? '', 10) || 12_000),
);

async function fetchSource(
  sourceId: SourceId,
  query: PointQuery,
  taskId?: string,
): Promise<ObservationResult> {
  switch (sourceId) {
    case 'power':
      return fetchPowerObservations(query);
    case 'gpm':
      return fetchGpmObservations(query, taskId);
    case 'smap':
      return fetchSmapObservations(query, undefined, taskId);
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
  if (result.observations.some((observation) => observation.value !== null)) return 'operational';
  return 'partially_operational';
}

async function fetchSourceEntry(
  sourceId: SourceId,
  query: PointQuery,
  taskId?: string,
): Promise<SourceHubEntry> {
  const startedAt = Date.now();
  try {
    const result = await Promise.race([
      fetchSource(sourceId, query, taskId),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new UpstreamError(
          `${sourceById[sourceId].name} did not respond within the source time budget.`,
          504,
          sourceId,
          'timeout',
        )), sourceDeadlineMs);
      }),
    ]);
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
  }
}

export async function fetchObservationHub(
  query: PointQuery,
  taskIds?: Partial<Record<SourceId, string>>,
): Promise<ObservationHubResult> {
  const startedAt = Date.now();
  const entries = await Promise.all(
    sourceIds.map((sourceId) => fetchSourceEntry(sourceId, query, taskIds?.[sourceId])),
  );
  const sources = Object.fromEntries(entries.map((entry) => [entry.sourceId, entry])) as Record<SourceId, SourceHubEntry>;

  return {
    retrievedAt: new Date().toISOString(),
    period: { start: query.startDate, end: query.endDate },
    durationMs: Date.now() - startedAt,
    sources,
  };
}

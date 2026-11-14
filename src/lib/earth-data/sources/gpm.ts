import { sourceById } from '../catalog';
import type { ObservationResult, PointQuery } from '../types';
import { fetchHarmonyPointRaster } from './harmony';

export async function fetchGpmObservations(query: PointQuery, taskId?: string): Promise<ObservationResult> {
  const retrievedAt = new Date().toISOString();
  const raster = await fetchHarmonyPointRaster({
    ...query,
    sourceId: 'gpm',
    collectionId: 'C2723754864-GES_DISC',
    variable: 'precipitation',
    productId: sourceById.gpm.productId,
    resolutionKm: 11.1,
    unit: 'mm/day',
  }, taskId);
  const observations = raster.observations;

  return {
    sourceId: 'gpm',
    productId: sourceById.gpm.productId,
    status: raster.processing
      ? 'processing'
      : observations.some((item) => item.value !== null) ? 'success' : 'empty',
    endpoint: sourceById.gpm.endpoint,
    responseFormat: 'image/tiff (NASA Harmony point-centered GeoTIFF subset)',
    observations,
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.gpm.spatialResolution,
    attribution: sourceById.gpm.attribution,
    message: raster.processing
      ? 'NASA Harmony is processing the GPM point subset.'
      : observations.some((item) => item.value !== null)
        ? undefined
        : 'NASA GPM returned no valid pixel for this location and period.',
    taskId: raster.taskId,
  };
}
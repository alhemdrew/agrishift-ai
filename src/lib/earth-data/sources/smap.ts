import { sourceById } from '../catalog';
import type { ObservationResult, PointQuery } from '../types';
import { fetchHarmonyPointRaster } from './harmony';

export type SmapVariable = 'surface' | 'rootzone';

const variables: Record<SmapVariable, string> = {
  surface: 'Geophysical_Data/sm_surface',
  rootzone: 'Geophysical_Data/sm_rootzone',
};

export async function fetchSmapObservations(
  query: PointQuery,
  variable: SmapVariable = 'surface',
  taskId?: string,
): Promise<ObservationResult> {
  const retrievedAt = new Date().toISOString();
  const raster = await fetchHarmonyPointRaster({
    ...query,
    sourceId: 'smap',
    collectionId: 'C3480440870-NSIDC_CPRD',
    variable: variables[variable],
    productId: sourceById.smap.productId,
    resolutionKm: 9,
    unit: 'm^3/m^3',
  }, taskId);
  const observations = raster.observations;

  return {
    sourceId: 'smap',
    productId: sourceById.smap.productId,
    status: raster.processing
      ? 'processing'
      : observations.some((item) => item.value !== null) ? 'success' : 'empty',
    endpoint: sourceById.smap.endpoint,
    responseFormat: 'image/tiff (NASA Harmony point-centered GeoTIFF subset)',
    observations,
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.smap.spatialResolution,
    attribution: sourceById.smap.attribution,
    message: raster.processing
      ? 'NASA Harmony is processing the SMAP point subset.'
      : observations.some((item) => item.value !== null)
        ? undefined
        : 'NASA SMAP returned no valid pixel for this location and period.',
    taskId: raster.taskId,
  };
}
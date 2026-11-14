import type { Observation, ObservationResult, PointQuery } from '../types';
import { UpstreamError } from '../types';
import { sourceById } from '../catalog';
import { fetchWithTimeout } from '../fetch-with-timeout';

const endpoint = sourceById.soilgrids.endpoint;
const citation = 'ISRIC — World Soil Information. SoilGrids global soil information at 250 m. https://soilgrids.org/';

interface SoilGridsDepth {
  label?: string;
  values?: {
    mean?: number | null;
    Q0_5?: number | null;
    Q0_5_value?: number | null;
    'Q0.5'?: number | null;
  };
}

interface SoilGridsLayer {
  name?: string;
  unit_measure?: { target_units?: string; mapped_units?: string; d_factor?: number };
  depths?: SoilGridsDepth[];
}

interface SoilGridsResponse {
  properties?: {
    layers?: SoilGridsLayer[];
  };
  layers?: SoilGridsLayer[];
}

function valueForLayer(layer: SoilGridsDepth): number | null {
  const values = layer.values ?? {};
  const candidates = [
    values.mean,
    values.Q0_5,
    values.Q0_5_value,
    values['Q0.5'],
  ];
  const numeric = candidates.find((candidate): candidate is number => typeof candidate === 'number' && Number.isFinite(candidate));
  return typeof numeric === 'number' ? numeric : null;
}

export async function fetchSoilgridsObservations(query: PointQuery): Promise<ObservationResult> {
  const properties = ['clay', 'silt', 'sand', 'soc', 'phh2o', 'bdod'];
  const retrievedAt = new Date().toISOString();
  const propertyResults = await Promise.allSettled(properties.map(async (property) => {
    const url = new URL(endpoint);
    url.searchParams.set('lon', String(query.longitude));
    url.searchParams.set('lat', String(query.latitude));
    url.searchParams.set('property', property);

    let response: Response;
    try {
      response = await fetchWithTimeout(url, { cache: 'no-store' });
    } catch {
      throw new UpstreamError('SoilGrids could not be reached. Check the network and retry.', 502, 'soilgrids');
    }

    if (!response.ok) {
      throw new UpstreamError(`SoilGrids returned HTTP ${response.status}.`, 502, 'soilgrids');
    }

    let body: SoilGridsResponse;
    try {
      body = (await response.json()) as SoilGridsResponse;
    } catch {
      throw new UpstreamError('SoilGrids returned an invalid JSON payload.', 502, 'soilgrids');
    }

    const layers = body.properties?.layers ?? body.layers ?? [];
    const layer = layers.find((entry) => (entry.name ?? '').toLowerCase() === property.toLowerCase());
    if (!layer || !Array.isArray(layer.depths)) return [];

    const observations: Observation[] = [];
    for (const depth of layer.depths) {
      const rawValue = valueForLayer(depth);
      if (rawValue === null || !Number.isFinite(rawValue)) continue;
      const unit = layer.unit_measure?.target_units || layer.unit_measure?.mapped_units || 'unitless';
      const depthLabel = depth.label ?? 'depth-unknown';
      observations.push({
        sourceId: 'soilgrids',
        productId: sourceById.soilgrids.productId,
        variable: `${property}_${depthLabel.replace(/\s+/g, '-')}`,
        value: rawValue,
        unit,
        latitude: query.latitude,
        longitude: query.longitude,
        observationTime: query.startDate,
        periodStart: query.startDate,
        periodEnd: query.endDate,
        spatialResolution: sourceById.soilgrids.spatialResolution,
        processingMetadata: {
          property,
          depthLabel,
          queryLat: query.latitude,
          queryLon: query.longitude,
          unitSource: layer.unit_measure?.mapped_units ?? null,
          targetUnit: layer.unit_measure?.target_units ?? null,
          conversionFactor: layer.unit_measure?.d_factor ?? null,
        },
        qualityFlags: [],
        retrievedAt,
        provenance: `${url.origin}${url.pathname}?lon=${query.longitude}&lat=${query.latitude}&property=${property}`,
        citation,
      });
    }
    return observations;
  }));
  const observations = propertyResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (observations.length === 0 && propertyResults.every((result) => result.status === 'rejected')) {
    const firstFailure = propertyResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (firstFailure?.reason instanceof UpstreamError) throw firstFailure.reason;
    throw new UpstreamError('SoilGrids did not return any property data.', 502, 'soilgrids');
  }

  return {
    sourceId: 'soilgrids',
    productId: sourceById.soilgrids.productId,
    status: observations.length > 0 ? 'success' : 'empty',
    endpoint: endpoint,
    responseFormat: 'application/json',
    observations,
    retrievedAt,
    period: { start: query.startDate, end: query.endDate },
    spatialResolution: sourceById.soilgrids.spatialResolution,
    attribution: sourceById.soilgrids.attribution,
    message: observations.length > 0
      ? undefined
      : 'SoilGrids did not return usable values for this point and depth set.',
  };
}

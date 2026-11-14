import { sourceById } from '../earth-data/catalog';
import type {
  Observation,
  ObservationHubResult,
  PointQuery,
  SourceId,
} from '../earth-data/types';

const sourceIds: SourceId[] = ['power', 'gpm', 'smap', 'modis', 'firms', 'soilgrids', 'chirps'];
const maxModelSamplesPerSource = 8;

export interface SelectedLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface AssistantEvidenceObservation {
  observation_id: string;
  source_id: SourceId;
  product_id: string;
  variable: string;
  value: number | string;
  unit: string;
  observation_time: string;
  observation_coordinates: { latitude: number; longitude: number };
  spatial_resolution: string;
  quality_flags: string[];
  provenance: string;
}

export interface AssistantObservationSummary {
  source_id: SourceId;
  product_id: string;
  variable: string;
  unit: string;
  observation_coordinates: { latitude: number; longitude: number };
  observation_count: number;
  first_observation_time: string;
  last_observation_time: string;
  minimum?: number;
  maximum?: number;
  arithmetic_mean?: number;
  latest_value: number | string;
  latest_observation_time: string;
}

export interface AssistantSourceContext {
  source_id: SourceId;
  dataset: string;
  product_id: string;
  product_name: string;
  availability: string;
  retrieval_status: string;
  requested_period: { start: string; end: string };
  spatial_resolution: string;
  observation_count: number;
  valid_observation_count: number;
  missing_observation_count: number;
  model_observation_count: number;
  omitted_observation_count: number;
  observation_summaries: AssistantObservationSummary[];
  observations: AssistantEvidenceObservation[];
}

export interface GroundedAssistantContext {
  selected_location: SelectedLocation;
  requested_period: { start: string; end: string };
  sources: AssistantSourceContext[];
  analytical_indicators: [];
}

type ObservationWithValue = Omit<Observation, 'value'> & { value: number | string };

function isWithinRequestedPeriod(observation: Observation, period: PointQuery): boolean {
  const date = observation.observationTime.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= period.startDate && date <= period.endDate;
}

function hasValue(observation: Observation): observation is ObservationWithValue {
  if (typeof observation.value === 'number') {
    return Number.isFinite(observation.value)
      && !(observation.sourceId === 'modis' && observation.variable === 'NDVI' && observation.value === -3000);
  }
  return typeof observation.value === 'string' && observation.value.trim().length > 0;
}

function toEvidenceObservation(
  observation: ObservationWithValue,
  index: number,
): AssistantEvidenceObservation {
  return {
    observation_id: `${observation.sourceId}:${observation.variable}:${observation.observationTime}:${index}`,
    source_id: observation.sourceId,
    product_id: observation.productId,
    variable: observation.variable,
    value: observation.value,
    unit: observation.unit,
    observation_time: observation.observationTime,
    observation_coordinates: {
      latitude: observation.latitude,
      longitude: observation.longitude,
    },
    spatial_resolution: observation.spatialResolution,
    quality_flags: observation.qualityFlags ?? [],
    provenance: observation.provenance,
  };
}

function coordinateKey(observation: ObservationWithValue): string {
  return `${observation.latitude}:${observation.longitude}`;
}

function summarizeObservations(
  sourceId: SourceId,
  observations: ObservationWithValue[],
): AssistantObservationSummary[] {
  const groups = new Map<string, ObservationWithValue[]>();
  for (const observation of observations) {
    const key = [
      observation.variable,
      observation.unit,
      observation.latitude,
      observation.longitude,
    ].join('|');
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  return Array.from(groups.values(), (group) => {
    const chronological = group.slice().sort((a, b) => a.observationTime.localeCompare(b.observationTime));
    const latest = chronological[chronological.length - 1];
    const numericValues = chronological
      .map((observation) => observation.value)
      .filter((value): value is number => typeof value === 'number');
    const numericSummary = numericValues.reduce(
      (summary, value) => ({
        minimum: Math.min(summary.minimum, value),
        maximum: Math.max(summary.maximum, value),
        sum: summary.sum + value,
      }),
      { minimum: Number.POSITIVE_INFINITY, maximum: Number.NEGATIVE_INFINITY, sum: 0 },
    );

    return {
      source_id: sourceId,
      product_id: latest.productId,
      variable: latest.variable,
      unit: latest.unit,
      observation_coordinates: { latitude: latest.latitude, longitude: latest.longitude },
      observation_count: chronological.length,
      first_observation_time: chronological[0].observationTime,
      last_observation_time: latest.observationTime,
      ...(numericValues.length > 0
        ? {
            minimum: numericSummary.minimum,
            maximum: numericSummary.maximum,
            arithmetic_mean: numericSummary.sum / numericValues.length,
          }
        : {}),
      latest_value: latest.value,
      latest_observation_time: latest.observationTime,
    };
  }).sort((a, b) =>
    a.variable.localeCompare(b.variable)
    || a.observation_coordinates.latitude - b.observation_coordinates.latitude
    || a.observation_coordinates.longitude - b.observation_coordinates.longitude,
  );
}

function representativeObservations(observations: ObservationWithValue[]): ObservationWithValue[] {
  const sorted = observations.slice().sort((a, b) => b.observationTime.localeCompare(a.observationTime));
  const selected: ObservationWithValue[] = [];
  const seenGroups = new Set<string>();

  for (const observation of sorted) {
    const key = `${observation.variable}|${observation.unit}|${coordinateKey(observation)}`;
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    selected.push(observation);
    if (selected.length === maxModelSamplesPerSource) return selected;
  }

  for (const observation of sorted) {
    if (selected.includes(observation)) continue;
    selected.push(observation);
    if (selected.length === maxModelSamplesPerSource) break;
  }
  return selected;
}

export function buildGroundedContext(
  hub: ObservationHubResult,
  location: SelectedLocation,
  period: PointQuery,
): GroundedAssistantContext {
  const sources = sourceIds.map((sourceId): AssistantSourceContext => {
    const definition = sourceById[sourceId];
    const entry = hub.sources[sourceId];
    const result = entry?.result;
    const sourceObservations = (result?.observations ?? [])
      .filter((observation) =>
        observation.sourceId === sourceId && isWithinRequestedPeriod(observation, period),
      );
    const observations = sourceObservations
      .filter((observation): observation is ObservationWithValue =>
        Number.isFinite(observation.latitude)
        && Number.isFinite(observation.longitude)
        && hasValue(observation),
      )
      .sort((a, b) => b.observationTime.localeCompare(a.observationTime));
    const samples = representativeObservations(observations);

    return {
      source_id: sourceId,
      dataset: definition.name,
      product_id: result?.productId ?? definition.productId,
      product_name: definition.productName,
      availability: entry?.availability ?? 'unavailable',
      retrieval_status: entry?.status ?? 'error',
      requested_period: { start: period.startDate, end: period.endDate },
      spatial_resolution: result?.spatialResolution ?? definition.spatialResolution,
      observation_count: sourceObservations.length,
      valid_observation_count: observations.length,
      missing_observation_count: sourceObservations.length - observations.length,
      model_observation_count: samples.length,
      omitted_observation_count: observations.length - samples.length,
      observation_summaries: summarizeObservations(sourceId, observations),
      observations: samples.map(toEvidenceObservation),
    };
  });

  return {
    selected_location: location,
    requested_period: { start: period.startDate, end: period.endDate },
    sources,
    analytical_indicators: [],
  };
}

export interface AssistantResponseEvidence {
  source_id: SourceId;
  dataset: string;
  product_id: string;
  variable: string;
  value: number | string;
  unit: string;
  observation_time: string;
  observation_coordinates: { latitude: number; longitude: number };
  spatial_resolution: string;
  quality_flags: string[];
  provenance: string;
}

export function responseEvidence(context: GroundedAssistantContext): AssistantResponseEvidence[] {
  return context.sources.flatMap((source) =>
    source.observations.map((observation) => ({
      source_id: source.source_id,
      dataset: source.dataset,
      product_id: observation.product_id,
      variable: observation.variable,
      value: observation.value,
      unit: observation.unit,
      observation_time: observation.observation_time,
      observation_coordinates: observation.observation_coordinates,
      spatial_resolution: observation.spatial_resolution,
      quality_flags: observation.quality_flags,
      provenance: observation.provenance,
    })),
  );
}

export function responseEvidenceSummaries(context: GroundedAssistantContext): AssistantObservationSummary[] {
  return context.sources.flatMap((source) => source.observation_summaries);
}

export function responseLimitations(context: GroundedAssistantContext): string[] {
  const sourceDescriptions: Record<SourceId, string> = {
    power: 'weather observations',
    gpm: 'satellite rainfall observations',
    smap: 'soil-moisture observations',
    modis: 'vegetation observations',
    firms: 'fire detections',
    soilgrids: 'soil-property observations',
    chirps: 'rainfall observations',
  };
  const limitations = new Set<string>();

  for (const source of context.sources) {
    if (source.retrieval_status === 'processing') {
      limitations.add(`${sourceDescriptions[source.source_id]} are still being prepared.`);
    } else if (source.retrieval_status === 'agreement_required' || source.retrieval_status === 'credentials_required') {
      limitations.add(`${sourceDescriptions[source.source_id]} were not available for this check.`);
    } else if (source.retrieval_status === 'error' || source.retrieval_status === 'timeout') {
      limitations.add(`${sourceDescriptions[source.source_id]} could not be retrieved for this check.`);
    } else if (source.retrieval_status === 'empty' || source.valid_observation_count === 0) {
      limitations.add(`No usable ${sourceDescriptions[source.source_id]} were returned for this place and period. Missing data is not zero.`);
    }
  }

  return Array.from(limitations);
}

import type { Observation, ObservationHubResult, SourceId } from '@/lib/earth-data/types';

export interface DashboardMetric {
  id: string;
  sourceId: SourceId;
  sourceName: string;
  variable: string;
  label: string;
  value: number | string | null;
  unit: string;
  observationTime?: string;
  status: string;
}

export interface SourceSummary {
  sourceId: SourceId;
  status: string;
  availability: string;
  observationCount: number;
  validObservationCount: number;
  errorMessage?: string;
}

const labels: Record<string, string> = {
  T2M: 'Average temperature',
  T2M_MAX: 'Maximum temperature',
  T2M_MIN: 'Minimum temperature',
  PRECTOTCORR: 'Precipitation',
  RH2M: 'Relative humidity',
  ALLSKY_SFC_SW_DWN: 'Solar radiation',
  precipitation: 'Precipitation',
  sm_surface: 'Surface soil moisture',
  sm_rootzone: 'Root-zone soil moisture',
  NDVI: 'Vegetation health',
  EVI: 'Enhanced vegetation',
  brightness: 'Fire brightness',
  frp: 'Fire radiative power',
  clay: 'Clay content',
  silt: 'Silt content',
  sand: 'Sand content',
  soc: 'Soil organic carbon',
  phh2o: 'Soil pH',
  bdod: 'Bulk density',
};

function validObservation(observation: Observation): boolean {
  return typeof observation.value === 'number' && Number.isFinite(observation.value);
}

function latestByVariable(observations: Observation[]): Observation[] {
  const latest = new Map<string, Observation>();
  for (const observation of observations) {
    if (!validObservation(observation)) continue;
    const current = latest.get(observation.variable);
    if (!current || observation.observationTime > current.observationTime) {
      latest.set(observation.variable, observation);
    }
  }
  return Array.from(latest.values());
}

export function dashboardMetrics(hub: ObservationHubResult): DashboardMetric[] {
  return Object.values(hub.sources)
    .flatMap((entry) => {
      const observations = latestByVariable(entry.result?.observations ?? []);
      return observations.map((observation) => ({
        id: `${observation.sourceId}:${observation.variable}`,
        sourceId: observation.sourceId,
        sourceName: entry.result?.attribution ?? observation.sourceId,
        variable: observation.variable,
        label: labels[observation.variable] ?? observation.variable,
        value: observation.value,
        unit: observation.unit,
        observationTime: observation.observationTime,
        status: entry.status,
      }));
    })
    .slice(0, 12);
}

export function sourceSummaries(hub: ObservationHubResult): SourceSummary[] {
  return Object.values(hub.sources).map((entry) => {
    const observations = entry.result?.observations ?? [];
    return {
      sourceId: entry.sourceId,
      status: entry.status,
      availability: entry.availability,
      observationCount: observations.length,
      validObservationCount: observations.filter(validObservation).length,
      errorMessage: entry.error?.message,
    };
  });
}

export function formatMetricValue(metric: DashboardMetric): string {
  if (typeof metric.value !== 'number') return metric.value ?? 'Unavailable';
  return metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatMetricUnit(unit: string): string {
  return unit === 'C' ? '°C' : unit === 'm^3/m^3' ? 'm³/m³' : unit;
}

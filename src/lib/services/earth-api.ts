import type { ObservationHubResult } from '@/lib/earth-data/types';

export interface EarthQuery {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}

export async function fetchObservationHub(query: EarthQuery, signal?: AbortSignal): Promise<ObservationHubResult> {
  const response = await fetch('/api/earth/observations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: 'all', ...query }),
    signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.message === 'string'
        ? payload.message
        : 'Environmental observations could not be loaded.',
    );
  }
  return payload as ObservationHubResult;
}

export interface LayerCatalogResponse {
  status: string;
  message?: string;
  layers: Array<{
    id: string;
    sourceId: string;
    label: string;
    description: string;
    available: boolean;
    observationDate?: string;
    legendUrl?: string;
    attribution: string;
  }>;
}

export async function fetchLayerCatalog(signal?: AbortSignal): Promise<LayerCatalogResponse> {
  const response = await fetch('/api/earth/layers', { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.message === 'string'
        ? payload.message
        : 'Environmental layers could not be loaded.',
    );
  }
  return payload as LayerCatalogResponse;
}

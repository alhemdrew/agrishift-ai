export type SourceId = 'power' | 'gpm' | 'smap' | 'modis' | 'firms' | 'soilgrids' | 'chirps';

export type RetrievalStatus =
  | 'success'
  | 'empty'
  | 'processing'
  | 'credentials_required'
  | 'agreement_required'
  | 'timeout'
  | 'error';
export type SourceAvailability = 'operational' | 'partially_operational' | 'unavailable';

export interface PointQuery {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}

export interface Observation {
  sourceId: SourceId;
  productId: string;
  variable: string;
  value: number | string | null;
  unit: string;
  latitude: number;
  longitude: number;
  observationTime: string;
  periodStart: string;
  periodEnd: string;
  spatialResolution: string;
  processingMetadata: Record<string, string | number | boolean | null>;
  qualityFlags?: string[];
  retrievedAt: string;
  provenance: string;
  citation: string;
}

export interface ObservationResult {
  sourceId: SourceId;
  productId: string;
  status: RetrievalStatus;
  endpoint: string;
  responseFormat: string;
  observations: Observation[];
  retrievedAt: string;
  period: { start: string; end: string };
  spatialResolution: string;
  attribution: string;
  message?: string;
  taskId?: string;
}

export interface SourceHubEntry {
  sourceId: SourceId;
  availability: SourceAvailability;
  status: RetrievalStatus;
  durationMs?: number;
  result?: ObservationResult;
  error?: { status: number; message: string };
}

export interface ObservationHubResult {
  retrievedAt: string;
  period: { start: string; end: string };
  durationMs?: number;
  sources: Record<SourceId, SourceHubEntry>;
}

export interface SourceDefinition {
  id: SourceId;
  name: string;
  productId: string;
  productName: string;
  endpoint: string;
  accessMethod: string;
  variables: Array<{ id: string; label: string; unit: string }>;
  temporalCoverage: string;
  temporalResolution: string;
  spatialResolution: string;
  pointAuthentication: string;
  attribution: string;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly sourceId: SourceId,
    readonly retrievalStatus?: RetrievalStatus,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}
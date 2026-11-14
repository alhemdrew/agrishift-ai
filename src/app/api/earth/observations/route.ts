import { NextResponse } from 'next/server';

import { sourceById } from '@/lib/earth-data/catalog';
import { fetchObservationHub } from '@/lib/earth-data/hub';
import { fetchFirmsObservations } from '@/lib/earth-data/sources/firms';
import { fetchGpmObservations } from '@/lib/earth-data/sources/gpm';
import { fetchModisObservations } from '@/lib/earth-data/sources/modis';
import { fetchPowerObservations } from '@/lib/earth-data/sources/power';
import { fetchSmapObservations } from '@/lib/earth-data/sources/smap';
import { UpstreamError, type PointQuery, type SourceId } from '@/lib/earth-data/types';

export const runtime = 'nodejs';

interface ObservationRequest {
  sourceId?: string;
  latitude?: number;
  longitude?: number;
  startDate?: string;
  endDate?: string;
  variable?: string;
  taskId?: string;
  taskIds?: Partial<Record<SourceId, string>>;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateRequest(body: ObservationRequest): { sourceId: SourceId | 'all'; query: PointQuery } {
  if (!body.sourceId || (body.sourceId !== 'all' && !(body.sourceId in sourceById))) {
    throw new UpstreamError('Select one of the configured Earth observation sources.', 400, 'power');
  }
  const sourceId = body.sourceId === 'all' ? 'all' : body.sourceId as SourceId;
  const { latitude, longitude, startDate, endDate } = body;
  if (!Number.isFinite(latitude) || latitude! < -90 || latitude! > 90) {
    throw new UpstreamError('Latitude must be between -90 and 90 degrees.', 400, sourceId === 'all' ? 'power' : sourceId);
  }
  if (!Number.isFinite(longitude) || longitude! < -180 || longitude! > 180) {
    throw new UpstreamError('Longitude must be between -180 and 180 degrees.', 400, sourceId === 'all' ? 'power' : sourceId);
  }
  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new UpstreamError('Choose valid start and end dates in YYYY-MM-DD format.', 400, sourceId === 'all' ? 'power' : sourceId);
  }
  if (startDate > endDate) {
    throw new UpstreamError('The start date must be on or before the end date.', 400, sourceId === 'all' ? 'power' : sourceId);
  }
  if (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`) > 366 * 86400000) {
    throw new UpstreamError('Choose an observation period no longer than 367 days.', 400, sourceId === 'all' ? 'power' : sourceId);
  }

  return { sourceId, query: { latitude: latitude!, longitude: longitude!, startDate, endDate } };
}

export async function POST(request: Request) {
  let body: ObservationRequest;
  try {
    body = (await request.json()) as ObservationRequest;
  } catch {
    return NextResponse.json({ status: 'error', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  try {
    const { sourceId, query } = validateRequest(body);
    if (sourceId === 'all') {
      return NextResponse.json(await fetchObservationHub(query, body.taskIds));
    }
    const result = sourceId === 'power'
      ? await fetchPowerObservations(query)
      : sourceId === 'gpm'
        ? await fetchGpmObservations(query, body.taskId)
        : sourceId === 'smap'
          ? await fetchSmapObservations(query, body.variable === 'rootzone' ? 'rootzone' : 'surface', body.taskId)
          : sourceId === 'modis'
            ? await fetchModisObservations(query, body.taskId)
            : await fetchFirmsObservations(query);

    return NextResponse.json(result, { status: result.status === 'processing' ? 202 : 200 });
  } catch (error) {
    if (error instanceof UpstreamError) {
      const status = error.httpStatus;
      return NextResponse.json({
        sourceId: error.sourceId,
        status: error.retrievalStatus ?? (status === 503 ? 'credentials_required' : 'error'),
        message: error.message,
        endpoint: sourceById[error.sourceId].endpoint,
        retrievedAt: new Date().toISOString(),
      }, { status });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Unexpected error while retrieving Earth observation data.',
      retrievedAt: new Date().toISOString(),
    }, { status: 500 });
  }
}
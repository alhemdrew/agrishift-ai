import { NextResponse } from 'next/server';

import { fetchObservationHub } from '@/lib/earth-data/hub';
import { assessAgriculture } from '@/lib/agriculture/assessment';
import type { PointQuery, SourceId } from '@/lib/earth-data/types';
import {
  buildGroundedContext,
  responseEvidenceSummaries,
  responseEvidence,
  responseLimitations,
  type SelectedLocation,
} from '@/lib/intelligence/context';
import {
  generateGroundedAnswer,
  isGeminiConfigured,
  GeminiServiceError,
  type AssistantTurn,
} from '@/lib/intelligence/gemini';
import {
  DEFAULT_ASSISTANT_LANGUAGE,
  isAssistantLanguage,
  type AssistantLanguage,
} from '@/lib/assistant/languages';

export const runtime = 'nodejs';
export const maxDuration = 60;

const maximumRequestBytes = 12_000;
const maximumHistoryTurns = 6;
const taskLifetimeMs = 45 * 60 * 1000;
const taskCache = new Map<string, { taskIds: Partial<Record<SourceId, string>>; expiresAt: number }>();
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const globalRequestCount = { count: 0, resetAt: 0 };

interface AssistantRequest {
  question: string;
  language: AssistantLanguage;
  location: SelectedLocation;
  period: { start: string; end: string };
  history: AssistantTurn[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateRequest(value: unknown): AssistantRequest | string {
  if (!isRecord(value) || !hasOnlyKeys(value, ['question', 'language', 'location', 'period', 'history'])) {
    return 'Request must contain only question, language, location, period, and history. Observation data is retrieved by the server.';
  }
  if (typeof value.question !== 'string' || value.question.trim().length < 2 || value.question.length > 1_000) {
    return 'Enter a question between 2 and 1,000 characters.';
  }
  const language = value.language === undefined ? DEFAULT_ASSISTANT_LANGUAGE : value.language;
  if (!isAssistantLanguage(language)) {
    return 'Choose English, Hausa, Yoruba, or Igbo.';
  }
  if (!isRecord(value.location) || !hasOnlyKeys(value.location, ['name', 'latitude', 'longitude'])) {
    return 'Provide a location name and coordinates.';
  }
  const { name, latitude, longitude } = value.location;
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 120) {
    return 'Location name must be between 1 and 120 characters.';
  }
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return 'Latitude must be between -90 and 90 degrees.';
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return 'Longitude must be between -180 and 180 degrees.';
  }
  if (!isRecord(value.period) || !hasOnlyKeys(value.period, ['start', 'end'])) {
    return 'Provide a valid start and end date.';
  }
  const { start, end } = value.period;
  if (typeof start !== 'string' || typeof end !== 'string' || !isIsoDate(start) || !isIsoDate(end) || start > end) {
    return 'Choose valid start and end dates in YYYY-MM-DD format.';
  }
  if (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) > 366 * 86_400_000) {
    return 'Choose an observation period no longer than 367 days.';
  }
  if (end > new Date().toISOString().slice(0, 10)) {
    return 'The observation period cannot end in the future.';
  }
  if (!Array.isArray(value.history) || value.history.length > maximumHistoryTurns) {
    return `Conversation history must contain no more than ${maximumHistoryTurns} turns.`;
  }
  const history: AssistantTurn[] = [];
  for (const turn of value.history) {
    if (
      !isRecord(turn)
      || !hasOnlyKeys(turn, ['role', 'content'])
      || (turn.role !== 'user' && turn.role !== 'assistant')
      || typeof turn.content !== 'string'
      || turn.content.length > 800
    ) {
      return 'Conversation history contains an invalid turn.';
    }
    history.push({ role: turn.role, content: turn.content });
  }

  return {
    question: value.question.trim(),
    language,
    location: { name: name.trim(), latitude, longitude },
    period: { start, end },
    history,
  };
}

async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumRequestBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

function taskKey(query: PointQuery): string {
  return `${query.latitude}:${query.longitude}:${query.startDate}:${query.endDate}`;
}

function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(request: Request): boolean {
  const now = Date.now();
  if (globalRequestCount.resetAt <= now) {
    globalRequestCount.count = 0;
    globalRequestCount.resetAt = now + 60_000;
  }
  if (globalRequestCount.count >= 30) return false;
  requestCounts.forEach((record, key) => {
    if (record.resetAt <= now) requestCounts.delete(key);
  });
  const identifier = requestIdentifier(request);
  const current = requestCounts.get(identifier);
  if (requestCounts.size >= 1_000 && !current) {
    const oldest = requestCounts.keys().next().value;
    if (oldest) requestCounts.delete(oldest);
  }
  if (!current || current.resetAt <= now) {
    requestCounts.set(identifier, { count: 1, resetAt: now + 60_000 });
    globalRequestCount.count += 1;
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  globalRequestCount.count += 1;
  return true;
}

function saveTaskIds(key: string, hub: Awaited<ReturnType<typeof fetchObservationHub>>): void {
  const taskIds: Partial<Record<SourceId, string>> = {};
  const sourceIds: SourceId[] = ['power', 'gpm', 'smap', 'modis', 'firms'];
  for (const sourceId of sourceIds) {
    const entry = hub.sources[sourceId];
    if (entry.result?.taskId) taskIds[sourceId] = entry.result.taskId;
  }
  if (Object.keys(taskIds).length > 0) {
    if (taskCache.size >= 100) {
      const oldest = taskCache.keys().next().value;
      if (oldest) taskCache.delete(oldest);
    }
    taskCache.set(key, { taskIds, expiresAt: Date.now() + taskLifetimeMs });
  } else {
    taskCache.delete(key);
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maximumRequestBytes) {
    return NextResponse.json({ status: 'invalid_request', message: 'Request is too large.' }, { status: 413 });
  }

  let rawBody: string | null;
  try {
    rawBody = await readLimitedBody(request);
  } catch {
    return NextResponse.json({ status: 'invalid_request', message: 'Request body could not be read.' }, { status: 400 });
  }
  if (rawBody === null) {
    return NextResponse.json({ status: 'invalid_request', message: 'Request is too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ status: 'invalid_request', message: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const validated = validateRequest(body);
  if (typeof validated === 'string') {
    return NextResponse.json({ status: 'invalid_request', message: validated }, { status: 400 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({
      status: 'configuration_error',
      message: 'Gemini is not configured. Add GEMINI_API_KEY to the server environment and restart the application.',
    }, { status: 503 });
  }
  if (!checkRateLimit(request)) {
    return NextResponse.json({
      status: 'rate_limited',
      message: 'Too many assistant requests. Wait a minute before trying again.',
    }, { status: 429 });
  }

  const query: PointQuery = {
    latitude: validated.location.latitude,
    longitude: validated.location.longitude,
    startDate: validated.period.start,
    endDate: validated.period.end,
  };
  const key = taskKey(query);
  const cached = taskCache.get(key);
  const taskIds = cached && cached.expiresAt > Date.now() ? cached.taskIds : undefined;
  if (cached && !taskIds) taskCache.delete(key);

  let hub: Awaited<ReturnType<typeof fetchObservationHub>> | undefined;
  try {
    const currentHub = await fetchObservationHub(query, taskIds);
    hub = currentHub;
    saveTaskIds(key, currentHub);
    const context = buildGroundedContext(currentHub, validated.location, query);
    const geminiStartedAt = Date.now();
    const agriculture = assessAgriculture(
      currentHub,
      validated.location.latitude,
      validated.location.longitude,
    );
    const answer = await generateGroundedAnswer(
      validated.question,
      validated.history,
      context,
      agriculture,
      validated.language,
    );
    const geminiDurationMs = Date.now() - geminiStartedAt;

    return NextResponse.json({
      answer,
      evidence: responseEvidence(context),
      evidence_summary: responseEvidenceSummaries(context),
      limitations: responseLimitations(context),
      source_statuses: context.sources.map((source) => ({
        source_id: source.source_id,
        dataset: source.dataset,
        product_id: source.product_id,
        spatial_resolution: source.spatial_resolution,
        availability: source.availability,
        retrieval_status: source.retrieval_status,
        observation_count: source.observation_count,
        valid_observation_count: source.valid_observation_count,
        missing_observation_count: source.missing_observation_count,
        model_observation_count: source.model_observation_count,
        error_http_status: currentHub.sources[source.source_id].error?.status ?? null,
        error_message: currentHub.sources[source.source_id].error?.message
          ?? currentHub.sources[source.source_id].result?.message
          ?? null,
        retrieval_duration_ms: currentHub.sources[source.source_id].durationMs ?? null,
      })),
      retrieval_duration_ms: currentHub.durationMs ?? null,
      gemini_duration_ms: geminiDurationMs,
      total_duration_ms: Date.now() - requestStartedAt,
      source_diagnostics: Object.values(currentHub.sources).map((source) => ({
        source_id: source.sourceId,
        status: source.status,
        duration_ms: source.durationMs ?? null,
        observation_count: source.result?.observations.length ?? 0,
      })),
      sources_used: Array.from(new Set(context.sources.flatMap((source) =>
        source.valid_observation_count > 0 ? [source.source_id] : [],
      ))),
      agriculture: {
        season: agriculture.season,
        crops: agriculture.crops,
        risks: agriculture.risks,
        missing_information: agriculture.missingInformation,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      const sourceDurations = hub
        ? Object.fromEntries(Object.values(hub.sources).map((source) => [
          source.sourceId,
          {
            duration_ms: source.durationMs ?? null,
            status: source.status,
            observation_count: source.result?.observations.length ?? 0,
          },
        ]))
        : {};
      return NextResponse.json({
        status: error.status,
        message: error.message,
        diagnostic: `${error.status} (HTTP ${error.httpStatus}${error.upstreamStatus ? `; upstream HTTP ${error.upstreamStatus}` : ''})`,
        upstream_status: error.upstreamStatus ?? null,
        upstream_message: error.upstreamMessage ?? null,
        retrieval_duration_ms: hub?.durationMs ?? null,
        total_duration_ms: Date.now() - requestStartedAt,
        source_durations: sourceDurations,
      }, { status: error.httpStatus });
    }
    return NextResponse.json({
      status: 'observation_error',
      message: 'The observation hub could not construct verified context. No answer was generated.',
    }, { status: 502 });
  }
}

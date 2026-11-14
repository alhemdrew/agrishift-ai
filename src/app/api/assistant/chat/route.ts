import { NextResponse } from 'next/server';

import { POST as assistantPost } from '@/app/api/assistant/route';

export async function POST(request: Request) {
  const body = await request.json() as { message?: string; lat?: number; lon?: number; history?: Array<{ role: 'user' | 'assistant'; text: string }> };
  const response = await assistantPost(new Request(request.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: body.message,
      location: { name: 'Selected location', latitude: body.lat, longitude: body.lon },
      period: { start: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), end: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
      history: (body.history ?? []).map((turn) => ({ role: turn.role, content: turn.text })),
    }),
  }));
  const payload = await response.json() as {
    answer?: string;
    message?: string;
    limitations?: string[];
    evidence_summary?: Array<{ latest_value: number | string; unit: string; variable: string }>;
    source_statuses?: Array<{
      source_id: string;
      retrieval_status: string;
      observation_count: number;
      valid_observation_count: number;
    }>;
    source_durations?: Record<string, { status: string; observation_count: number }>;
  };
  return NextResponse.json({
    answer: payload.answer ?? 'The assistant could not produce an answer from the available observations.',
    message: payload.message,
    key_insights: (payload.evidence_summary ?? []).slice(0, 3).map((item) => `${item.variable}: ${item.latest_value} ${item.unit}`),
    uncertainty: (payload.limitations ?? []).join(' '),
    suggested_questions: [],
    chart: null,
    source: 'PHANTOMGREEN grounded assistant',
    source_statuses: payload.source_statuses ?? Object.entries(payload.source_durations ?? {}).map(([source_id, source]) => ({
      source_id,
      retrieval_status: source.status,
      observation_count: source.observation_count,
      valid_observation_count: source.observation_count,
    })),
  }, { status: response.status });
}

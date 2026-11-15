import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GroundedAssistantContext } from './context';
import { generateGroundedAnswer } from './gemini';

const context: GroundedAssistantContext = {
  selected_location: { name: 'Kaduna', latitude: 10.5225, longitude: 7.4389 },
  requested_period: { start: '2026-11-01', end: '2026-11-14' },
  sources: [{
    source_id: 'smap',
    dataset: 'NASA SMAP',
    product_id: 'SMAP_TEST',
    product_name: 'Soil moisture',
    availability: 'unavailable',
    retrieval_status: 'unavailable',
    requested_period: { start: '2026-11-01', end: '2026-11-14' },
    spatial_resolution: 'unknown',
    observation_count: 0,
    valid_observation_count: 0,
    missing_observation_count: 0,
    model_observation_count: 0,
    omitted_observation_count: 0,
    observation_summaries: [],
    observations: [],
  }],
  analytical_indicators: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Gemini language selection', () => {
  it.each([
    ['en', 'English'],
    ['ha', 'Hausa'],
    ['yo', 'Yoruba'],
    ['ig', 'Igbo'],
  ] as const)('instructs Gemini to answer in %s', async (language, languageName) => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: `${languageName} grounded answer` }] } }],
      }), { status: 200 });
    }));

    await expect(generateGroundedAnswer('What are the conditions?', [], context, undefined, language))
      .resolves.toBe(`${languageName} grounded answer`);

    const systemInstruction = requestBody?.systemInstruction as { parts: Array<{ text: string }> };
    const modelContext = (requestBody?.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text;
    expect(systemInstruction.parts[0].text).toContain(`natural, conversational ${languageName}`);
    expect(systemInstruction.parts[0].text).toContain('NASA observations');
    expect(systemInstruction.parts[0].text).toContain('A short rainfall window is not a seasonal rainfall trend');
    expect(systemInstruction.parts[0].text).toContain('Missing soil-moisture observations are unknown');
    expect(systemInstruction.parts[0].text).toContain('do not upgrade uncertain or not-in-window crops into recommendations');
    expect(modelContext).toContain('Server-verified observation context');
    expect(modelContext).toContain('Kaduna');
    expect(modelContext).toContain('"source_id":"smap"');
    expect(modelContext).toContain('"observation_count":0');
    expect(modelContext).not.toContain('"value":0');
  });

  it('reports a missing API key without making a provider request', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateGroundedAnswer('Question', [], context))
      .rejects.toMatchObject({ status: 'configuration_error', httpStatus: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps Gemini quota and timeout failures to explicit service errors', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 }))
      .mockRejectedValueOnce(new DOMException('Request timed out', 'TimeoutError')));

    await expect(generateGroundedAnswer('Question', [], context))
      .rejects.toMatchObject({ status: 'rate_limited', httpStatus: 429 });
    await expect(generateGroundedAnswer('Question', [], context))
      .rejects.toMatchObject({ status: 'timeout', httpStatus: 504 });
  });

  it('rejects a successful but malformed Gemini response', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 })));
    await expect(generateGroundedAnswer('Question', [], context))
      .rejects.toMatchObject({
        status: 'invalid_response',
        httpStatus: 502,
        message: 'Gemini returned no text for this question. Please try again.',
      });
  });

  it('reports a blocked generation without exposing provider details', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      promptFeedback: { blockReason: 'SAFETY' },
      candidates: [],
    }), { status: 200 })));
    await expect(generateGroundedAnswer('Question', [], context))
      .rejects.toMatchObject({
        status: 'invalid_response',
        httpStatus: 502,
        message: 'Gemini could not provide an answer for this question. Try rephrasing it.',
      });
  });
});

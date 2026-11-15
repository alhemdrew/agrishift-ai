import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

function assistantRequest(language: string) {
  return new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: 'What does the available data show?',
      language,
      location: { name: 'Kaduna', latitude: 10.5225, longitude: 7.4389 },
      period: { start: '2026-11-01', end: '2026-11-14' },
      history: [],
    }),
  });
}

describe('assistant language request validation', () => {
  it('rejects unsupported language codes before observation retrieval', async () => {
    const response = await POST(assistantRequest('fr'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: 'invalid_request',
      message: 'Choose English, Hausa, Yoruba, or Igbo.',
    });
  });

  it.each(['en', 'ha', 'yo', 'ig'])('accepts %s and keeps Gemini configuration server-side', async (language) => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const response = await POST(assistantRequest(language));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: 'configuration_error' });
  });
});

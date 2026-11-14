import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from './fetch-with-timeout';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWithTimeout', () => {
  it('passes a bounded abort signal to the underlying fetch', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);

    await fetchWithTimeout('https://example.test/data', {}, 1);

    expect(fetch).toHaveBeenCalledWith(
      'https://example.test/data',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect((fetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(false);
  });

  it.each([401, 403])('does not retry non-retryable HTTP %s responses', async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response('denied', { status }));
    vi.stubGlobal('fetch', fetch);

    const response = await fetchWithTimeout('https://example.test/data');

    expect(response.status).toBe(status);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500, 503])('retries an idempotent GET once after HTTP %s', async (status) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('temporary failure', { status }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const response = await fetchWithTimeout('https://example.test/data');

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a task-submission POST', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetch);

    const response = await fetchWithTimeout('https://example.test/task', { method: 'POST' });

    expect(response.status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a connection failure only once', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchWithTimeout('https://example.test/data')).resolves.toMatchObject({ status: 200 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a timeout', async () => {
    const timeout = new DOMException('timed out', 'TimeoutError');
    const fetch = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal('fetch', fetch);

    await expect(fetchWithTimeout('https://example.test/data')).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('honors long Retry-After values instead of retrying early', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '5' },
    }));
    vi.stubGlobal('fetch', fetch);

    const response = await fetchWithTimeout('https://example.test/data');

    expect(response.status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

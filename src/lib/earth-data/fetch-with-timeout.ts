import 'server-only';

const defaultRequestTimeoutMs = 15_000;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = Number.parseInt(process.env.EARTH_DATA_SOURCE_TIMEOUT_MS ?? '', 10) || defaultRequestTimeoutMs,
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const retryableMethod = method === 'GET';
  const maxAttempts = retryableMethod ? 2 : 1;
  const totalTimeoutMs = Math.min(30_000, Math.max(1_000, timeoutMs));
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remainingMs = totalTimeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw lastError instanceof Error ? lastError : new DOMException('Request timed out.', 'TimeoutError');
    }
    const timeoutSignal = AbortSignal.timeout(Math.min(30_000, Math.max(1, remainingMs)));
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    try {
      const response = await fetch(input, { ...init, signal });
      const retryableStatus = response.status === 429 || [500, 502, 503, 504].includes(response.status);
      if (!retryableStatus || attempt + 1 >= maxAttempts || init.signal?.aborted) return response;
      const retryAfter = response.headers.get('retry-after');
      const retryAfterSeconds = Number(retryAfter);
      const retryAfterDate = retryAfter && !Number.isFinite(retryAfterSeconds) ? Date.parse(retryAfter) - Date.now() : NaN;
      const requestedDelay = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1_000
        : retryAfterDate;
      if (Number.isFinite(requestedDelay) && requestedDelay > 1_000) return response;
      await response.body?.cancel();
      const delayMs = Number.isFinite(requestedDelay)
        ? Math.min(1_000, Math.max(0, requestedDelay))
        : 150 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      lastError = error;
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (timedOut || attempt + 1 >= maxAttempts || init.signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after bounded retries.');
}

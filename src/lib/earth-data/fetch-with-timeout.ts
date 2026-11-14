import 'server-only';

const defaultRequestTimeoutMs = 10_000;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = Number.parseInt(process.env.EARTH_DATA_SOURCE_TIMEOUT_MS ?? '', 10) || defaultRequestTimeoutMs,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(Math.min(30_000, Math.max(1_000, timeoutMs)));
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
}

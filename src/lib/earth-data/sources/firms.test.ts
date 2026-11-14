import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchFirmsObservations } from './firms';

const query = {
  latitude: 10.5225,
  longitude: 7.4389,
  startDate: '2024-01-01',
  endDate: '2024-01-02',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('NASA FIRMS adapter', () => {
  it('parses detections with units, timestamps, quality metadata, and redacted provenance', async () => {
    vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-map-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response([
      'latitude,longitude,acq_date,acq_time,confidence,frp,brightness,bright_t31,satellite,instrument,daynight,scan,track',
      '10.52,7.44,2024-01-01,1234,h,42.5,340.1,310.2,N,VIIRS,D,0.5,0.6',
    ].join('\n'), { status: 200 })));

    const result = await fetchFirmsObservations(query);

    expect(result.status).toBe('success');
    expect(result.observations).toHaveLength(3);
    expect(result.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        variable: 'frp',
        value: 42.5,
        unit: 'MW',
        observationTime: '2024-01-01T12:34:00Z',
        qualityFlags: ['CONFIDENCE_H'],
      }),
      expect.objectContaining({ variable: 'brightness', value: 340.1, unit: 'K' }),
      expect.objectContaining({ variable: 'bright_t31', value: 310.2, unit: 'K' }),
    ]));
    expect(result.observations[0].provenance).not.toContain('test-map-key');
  });

  it('rejects unsupported request ranges before contacting the provider', async () => {
    vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-map-key');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(fetchFirmsObservations({
      ...query,
      endDate: '2024-01-06',
    })).rejects.toThrow('1 to 5 days');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces provider HTTP failures as sanitized errors', async () => {
    vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-map-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 403 })));

    await expect(fetchFirmsObservations(query)).rejects.toThrow('NASA FIRMS returned HTTP 403');
  });

  it('returns empty for a valid CSV with no detections and rejects malformed CSV', async () => {
    vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-map-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'latitude,longitude,acq_date,acq_time\n',
      { status: 200 },
    )));
    await expect(fetchFirmsObservations(query)).resolves.toMatchObject({
      status: 'empty',
      observations: [],
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not,csv', { status: 200 })));
    await expect(fetchFirmsObservations(query)).rejects.toThrow('unrecognized CSV');
  });

  it('requires server-side credentials', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(fetchFirmsObservations(query)).rejects.toThrow('NASA_FIRMS_MAP_KEY is not configured');
    expect(fetch).not.toHaveBeenCalled();
  });
});

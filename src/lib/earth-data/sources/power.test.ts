import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPowerObservations } from './power';

const query = {
  latitude: 10.5225,
  longitude: 7.4389,
  startDate: '2024-01-01',
  endDate: '2024-01-02',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NASA POWER adapter', () => {
  it('normalizes valid observations, units, timestamps, fill values, and provenance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      geometry: { coordinates: [7.4389, 10.5225] },
      header: { fill_value: -999, time_standard: 'UTC' },
      properties: {
        parameter: {
          T2M: { '20240101': 25.5, '20240102': -999 },
        },
      },
      parameters: { T2M: { units: 'C', longname: 'Temperature at 2 Meters' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const result = await fetchPowerObservations(query);

    expect(result.status).toBe('success');
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0]).toMatchObject({
      value: 25.5,
      unit: 'C',
      observationTime: '2024-01-01',
      latitude: 10.5225,
      longitude: 7.4389,
    });
    expect(result.observations[1]).toMatchObject({
      value: null,
      qualityFlags: ['NASA_POWER_FILL_VALUE'],
    });
    expect(result.observations[0].provenance).toContain('power.larc.nasa.gov');
  });

  it('rejects an invalid provider payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    await expect(fetchPowerObservations(query)).rejects.toThrow('unrecognized response');
  });

  it('surfaces provider HTTP and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
    await expect(fetchPowerObservations(query)).rejects.toThrow('NASA POWER returned HTTP 503');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchPowerObservations(query)).rejects.toThrow('could not be reached');
  });
});

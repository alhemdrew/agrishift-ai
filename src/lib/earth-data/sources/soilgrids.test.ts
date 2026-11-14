import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSoilgridsObservations } from './soilgrids';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SoilGrids adapter', () => {
  it('preserves the live depth structure and returns empty when the provider has no estimates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      properties: {
        layers: [{
          name: 'clay',
          unit_measure: { mapped_units: 'g/kg', target_units: '%', d_factor: 10 },
          depths: [{
            label: '0-5cm',
            values: { mean: 217.5 },
          }],
        }],
      },
    }), { status: 200 })));

    const result = await fetchSoilgridsObservations({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-30',
    });

    expect(result.status).toBe('success');
    expect(result.observations[0]).toMatchObject({
      variable: 'clay_0-5cm',
      value: 217.5,
      unit: '%',
      observationTime: '2024-01-01',
    });
  });

  it('returns empty when valid responses contain no matching property layers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      properties: { layers: [{ name: 'phh2o', depths: [] }] },
    }), { status: 200 })));

    const result = await fetchSoilgridsObservations({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-30',
    });

    expect(result.status).toBe('empty');
    expect(result.observations).toHaveLength(0);
  });

  it('rejects malformed JSON and reports provider failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })));
    await expect(fetchSoilgridsObservations({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-30',
    })).rejects.toThrow('invalid JSON');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchSoilgridsObservations({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-30',
    })).rejects.toThrow('could not be reached');
  });
});

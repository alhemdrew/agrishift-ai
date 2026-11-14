import { describe, expect, it } from 'vitest';

import { buildGroundedContext } from './context';

describe('grounded intelligence context', () => {
  it('includes only valid observations and preserves source separation', () => {
    const result = buildGroundedContext({
      retrievedAt: '2024-01-02T00:00:00Z',
      period: { start: '2024-01-01', end: '2024-01-01' },
      sources: {
        power: {
          sourceId: 'power',
          availability: 'operational',
          status: 'success',
          result: {
            sourceId: 'power',
            productId: 'POWER',
            status: 'success',
            endpoint: 'https://power.example',
            responseFormat: 'json',
            observations: [{
              sourceId: 'power',
              productId: 'POWER',
              variable: 'T2M',
              value: 25,
              unit: 'C',
              latitude: 10.5225,
              longitude: 7.4389,
              observationTime: '2024-01-01',
              periodStart: '2024-01-01',
              periodEnd: '2024-01-01',
              spatialResolution: '0.5 degree',
              processingMetadata: {},
              retrievedAt: '2024-01-02T00:00:00Z',
              provenance: 'https://power.example',
              citation: 'POWER',
            }],
            retrievedAt: '2024-01-02T00:00:00Z',
            period: { start: '2024-01-01', end: '2024-01-01' },
            spatialResolution: '0.5 degree',
            attribution: 'POWER',
          },
        },
        gpm: { sourceId: 'gpm', availability: 'unavailable', status: 'timeout' },
        smap: { sourceId: 'smap', availability: 'unavailable', status: 'error' },
        modis: { sourceId: 'modis', availability: 'unavailable', status: 'processing' },
        firms: { sourceId: 'firms', availability: 'unavailable', status: 'empty' },
        soilgrids: { sourceId: 'soilgrids', availability: 'unavailable', status: 'error' },
        chirps: { sourceId: 'chirps', availability: 'unavailable', status: 'timeout' },
      },
    }, { name: 'Kaduna', latitude: 10.5225, longitude: 7.4389 }, {
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    });

    expect(result.sources.find((source) => source.source_id === 'power')?.valid_observation_count).toBe(1);
    expect(result.sources.find((source) => source.source_id === 'gpm')?.valid_observation_count).toBe(0);
    expect(result.sources).toHaveLength(7);
  });
});

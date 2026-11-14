import { describe, expect, it, vi } from 'vitest';
import type { ObservationResult } from './types';

vi.mock('./sources/power', () => ({
  fetchPowerObservations: vi.fn().mockResolvedValue({
    sourceId: 'power',
    productId: 'POWER',
    status: 'success',
    endpoint: 'https://power.example',
    responseFormat: 'application/json',
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
  }),
}));

vi.mock('./sources/gpm', () => ({ fetchGpmObservations: vi.fn().mockRejectedValue(new Error('GPM unavailable')) }));
vi.mock('./sources/smap', () => ({ fetchSmapObservations: vi.fn().mockRejectedValue(new Error('SMAP unavailable')) }));
vi.mock('./sources/modis', () => ({ fetchModisObservations: vi.fn().mockRejectedValue(new Error('MODIS unavailable')) }));
vi.mock('./sources/firms', () => ({ fetchFirmsObservations: vi.fn().mockRejectedValue(new Error('FIRMS unavailable')) }));
vi.mock('./sources/soilgrids', () => ({ fetchSoilgridsObservations: vi.fn().mockRejectedValue(new Error('SoilGrids unavailable')) }));
vi.mock('./sources/chirps', () => ({ fetchChirpsObservations: vi.fn().mockRejectedValue(new Error('CHIRPS unavailable')) }));

import { fetchObservationHub } from './hub';
import { fetchPowerObservations } from './sources/power';
import { fetchFirmsObservations } from './sources/firms';

describe('observation hub', () => {
  it('isolates simultaneous source failures without rejecting the hub', async () => {
    vi.mocked(fetchPowerObservations).mockRejectedValueOnce(new Error('POWER unavailable'));
    const result = await fetchObservationHub({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    });

    expect(Object.keys(result.sources)).toHaveLength(7);
    expect(result.sources.power.status).toBe('error');
    expect(result.sources.gpm.status).toBe('error');
    expect(result.sources.chirps.status).toBe('error');
    expect(result.sources.power.diagnostic).toMatchObject({
      status: 'unavailable',
      observationCount: 0,
      dataOrigin: 'none',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('marks a validated provider result healthy while isolating other provider failures', async () => {
    const observation = {
      sourceId: 'power' as const,
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
      citation: 'NASA POWER',
    };
    vi.mocked(fetchPowerObservations).mockResolvedValueOnce({
      sourceId: 'power',
      productId: 'POWER',
      status: 'success',
      endpoint: 'https://power.example',
      responseFormat: 'application/json',
      observations: [observation, { ...observation }],
      retrievedAt: '2024-01-02T00:00:00Z',
      period: { start: '2024-01-01', end: '2024-01-01' },
      spatialResolution: '0.5 degree',
      attribution: 'NASA POWER',
    } satisfies ObservationResult);

    const result = await fetchObservationHub({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    });

    expect(result.sources.power.result?.observations).toHaveLength(1);
    expect(result.sources.power.diagnostic).toMatchObject({
      status: 'healthy',
      observationCount: 1,
      latestObservationTime: '2024-01-01',
      dataOrigin: 'genuine_provider',
      latestObservations: [{ variable: 'T2M', value: 25, unit: 'C' }],
    });
    expect(result.sources.gpm.diagnostic?.status).toBe('unavailable');
  });

  it('limits a long FIRMS window to its latest supported five days', async () => {
    const fetchFirms = vi.mocked(fetchFirmsObservations);
    fetchFirms.mockImplementationOnce(async (query) => ({
      sourceId: 'firms',
      productId: 'VIIRS_NOAA21_NRT',
      status: 'empty',
      endpoint: 'https://firms.example',
      responseFormat: 'text/csv',
      observations: [],
      retrievedAt: '2024-04-02T00:00:00Z',
      period: { start: query.startDate, end: query.endDate },
      spatialResolution: '375 m',
      attribution: 'NASA FIRMS',
      message: 'No detections.',
    }));

    const result = await fetchObservationHub({
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-04-01',
    });

    expect(fetchFirms).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2024-03-28',
      endDate: '2024-04-01',
    }));
    expect(result.sources.firms.diagnostic?.observationPeriod).toEqual({
      start: '2024-03-28',
      end: '2024-04-01',
    });
    expect(result.sources.firms.diagnostic?.status).toBe('healthy');
  });
});

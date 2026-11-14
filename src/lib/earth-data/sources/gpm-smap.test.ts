import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./harmony', () => ({
  fetchHarmonyPointRaster: vi.fn(),
}));

import { fetchHarmonyPointRaster } from './harmony';
import { fetchGpmObservations } from './gpm';
import { fetchSmapObservations } from './smap';

const query = {
  latitude: 10.5225,
  longitude: 7.4389,
  startDate: '2024-01-01',
  endDate: '2024-01-02',
};

afterEach(() => {
  vi.mocked(fetchHarmonyPointRaster).mockReset();
});

describe('GPM and SMAP adapters', () => {
  it('preserves GPM processing state and task identifier', async () => {
    vi.mocked(fetchHarmonyPointRaster).mockResolvedValue({
      processing: true,
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      observations: [],
    });

    const result = await fetchGpmObservations(query, '123e4567-e89b-12d3-a456-426614174000');

    expect(result.status).toBe('processing');
    expect(result.observations).toHaveLength(0);
    expect(result.taskId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(fetchHarmonyPointRaster).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'gpm',
      variable: 'precipitation',
      unit: 'mm/day',
    }), '123e4567-e89b-12d3-a456-426614174000');
  });

  it('preserves SMAP completion observations and selected variable', async () => {
    vi.mocked(fetchHarmonyPointRaster).mockResolvedValue({
      processing: false,
      observations: [{
        sourceId: 'smap',
        productId: 'SPL4SMGP.008',
        variable: 'Geophysical_Data/sm_rootzone',
        value: 0.24,
        unit: 'm^3/m^3',
        latitude: query.latitude,
        longitude: query.longitude,
        observationTime: '2024-01-01T00:00:00Z',
        periodStart: query.startDate,
        periodEnd: query.endDate,
        spatialResolution: '9 km EASE-Grid 2.0',
        processingMetadata: {},
        retrievedAt: '2024-01-02T00:00:00Z',
        provenance: 'https://harmony.earthdata.nasa.gov/result',
        citation: 'NASA SMAP',
      }],
    });

    const result = await fetchSmapObservations(query, 'rootzone');

    expect(result.status).toBe('success');
    expect(result.observations[0]).toMatchObject({
      value: 0.24,
      unit: 'm^3/m^3',
      variable: 'Geophysical_Data/sm_rootzone',
    });
    expect(fetchHarmonyPointRaster).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'smap',
      variable: 'Geophysical_Data/sm_rootzone',
    }), undefined);
  });

  it('reports empty completed results without claiming success', async () => {
    vi.mocked(fetchHarmonyPointRaster).mockResolvedValue({
      processing: false,
      observations: [],
    });

    const result = await fetchGpmObservations(query);

    expect(result.status).toBe('empty');
    expect(result.observations).toHaveLength(0);
  });
});

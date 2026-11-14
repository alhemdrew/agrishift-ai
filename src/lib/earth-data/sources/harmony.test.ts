import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('geotiff', () => ({
  fromArrayBuffer: vi.fn(),
}));

import { fromArrayBuffer } from 'geotiff';
import { fetchHarmonyPointRaster } from './harmony';

const query = {
  latitude: 10.5225,
  longitude: 7.4389,
  startDate: '2024-01-01',
  endDate: '2024-01-02',
  sourceId: 'gpm' as const,
  collectionId: 'C2723754864-GES_DISC',
  variable: 'precipitation',
  productId: 'GPM_3IMERGDF.07',
  resolutionKm: 11.1,
  unit: 'mm/day',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(fromArrayBuffer).mockReset();
});

describe('NASA Harmony workflow', () => {
  it('returns processing after a submitted job remains incomplete', async () => {
    vi.stubEnv('NASA_EARTHDATA_TOKEN', 'test-token');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: 'https://harmony.earthdata.nasa.gov/jobs/123e4567-e89b-12d3-a456-426614174000' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'running' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })));

    const result = await fetchHarmonyPointRaster(query);

    expect(result).toMatchObject({
      processing: true,
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      observations: [],
    });
  });

  it('polls a completed job, downloads its GeoTIFF, and preserves observation metadata', async () => {
    vi.stubEnv('NASA_EARTHDATA_TOKEN', 'test-token');
    vi.mocked(fromArrayBuffer).mockResolvedValue({
      getImageCount: async () => 1,
      getImage: async () => ({
        readRasters: async () => [2.5],
        getGDALNoData: () => -999,
        getFileDirectory: () => ({ ImageDescription: 'daily precipitation' }),
      }),
    } as never);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'successful',
        links: [{ rel: 'data', href: 'https://harmony.earthdata.nasa.gov/data/gpm-20240101T000000.tif' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/tiff' },
      })));

    const result = await fetchHarmonyPointRaster(query, '123e4567-e89b-12d3-a456-426614174000');

    expect(result.processing).toBe(false);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      value: 2.5,
      unit: 'mm/day',
      observationTime: '2024-01-01T00:00:00Z',
      latitude: 10.5225,
      longitude: 7.4389,
      sourceId: 'gpm',
    });
    expect(result.observations[0].provenance).toContain('harmony.earthdata.nasa.gov');
  });

  it('rejects authorization responses without exposing the token', async () => {
    vi.stubEnv('NASA_EARTHDATA_TOKEN', 'secret-test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })));

    const error = await fetchHarmonyPointRaster(query).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ message: expect.stringContaining('Earthdata authorization was rejected') });
    expect(error).not.toHaveProperty('message', expect.stringContaining('secret-test-token'));
  });

  it('distinguishes an empty granule search from a provider failure', async () => {
    vi.stubEnv('NASA_EARTHDATA_TOKEN', 'test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'harmony.RequestValidationError',
      description: 'Error: No matching granules found.',
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })));

    await expect(fetchHarmonyPointRaster(query)).rejects.toMatchObject({
      sourceId: 'gpm',
      retrievalStatus: 'empty',
    });
  });
});

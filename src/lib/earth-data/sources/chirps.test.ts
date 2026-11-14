import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchChirpsObservations, observationFromRasterValue, observationsFromChirpsGeoTiff } from './chirps';
import { writeArrayBuffer } from 'geotiff';

const query = {
  latitude: 10.5225,
  longitude: 7.4389,
  startDate: '2024-01-01',
  endDate: '2024-01-02',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CHIRPS adapter', () => {
  it('samples the containing WGS84 cell and preserves date, units, and provenance', async () => {
    const raster = await writeArrayBuffer([1, 2, 3, 4], {
      width: 2,
      height: 2,
      GeographicTypeGeoKey: 4326,
      ModelPixelScale: [0.05, 0.05, 0],
      ModelTiepoint: [0, 0, 0, 7.4, 10.55, 0],
    });

    const observations = await observationsFromChirpsGeoTiff(
      raster,
      query,
      '2024-01-01',
      'https://data.example/chirps-v2.0.2024.01.01.tif.gz',
    );

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      value: 1,
      unit: 'mm/day',
      observationTime: '2024-01-01',
      provenance: 'https://data.example/chirps-v2.0.2024.01.01.tif.gz',
      processingMetadata: {
        coordinateReferenceSystem: 'EPSG:4326',
        sampling: 'containing-cell',
      },
    });
  });

  it('preserves NoData as null rather than zero', async () => {
    const observation = observationFromRasterValue(
      -9999,
      query,
      [7.4, 10.6],
      [0.05, -0.05],
      4,
      4,
      -9999,
    );

    expect(observation).toMatchObject({
      value: null,
      qualityFlags: ['CHIRPS_NODATA'],
    });
  });

  it('reports unavailable archive access as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));

    await expect(fetchChirpsObservations(query)).rejects.toThrow('CHIRPS returned HTTP 404');
  });

  it('preserves network failures as unavailable rather than empty observations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(fetchChirpsObservations(query)).rejects.toMatchObject({ sourceId: 'chirps' });
  });

  it('bounds daily archive request concurrency', async () => {
    let active = 0;
    let maximumActive = 0;
    const fetch = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response('unavailable', { status: 404 });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(fetchChirpsObservations({
      ...query,
      endDate: '2024-01-05',
    })).rejects.toThrow('CHIRPS returned HTTP 404');

    expect(fetch).toHaveBeenCalledTimes(5);
    expect(maximumActive).toBeLessThanOrEqual(3);
  });
});

import type { ObservationResult, PointQuery } from '../types';
import { UpstreamError } from '../types';
import { sourceById } from '../catalog';
import { fetchWithTimeout } from '../fetch-with-timeout';

const archiveRoot = 'https://data.chc.ucsb.edu/products/CHIRPS-2.0';
const archivePaths = [
  `${archiveRoot}/global_daily/tifs/p05/`,
  `${archiveRoot}/global_daily/tifs/`,
  `${archiveRoot}/global_daily/`,
];

function archiveUrls(date: string): string[] {
  const year = date.slice(0, 4);
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  return [
    `${archiveRoot}/global_daily/tifs/p05/${year}/${month}/chirps-v2.0.${year}.${month}.${day}.tif`,
    `${archiveRoot}/global_daily/tifs/p05/${year}/${month}/chirps-v2.0.${year}.${month}.${day}.tif.gz`,
    `${archiveRoot}/global_daily/tifs/p05/${year}/${month}/chirps-v2.0.${date}.tif`,
  ];
}

export async function fetchChirpsObservations(query: PointQuery): Promise<ObservationResult> {
  const candidateDates = query.startDate === query.endDate
    ? [query.startDate]
    : [query.startDate, query.endDate];
  const candidateUrls = candidateDates.flatMap(archiveUrls);
  const responses = await Promise.allSettled(candidateUrls.map(async (url) => ({
    url,
    response: await fetchWithTimeout(url, { cache: 'no-store' }),
  })));
  const available = responses.find(
    (result): result is PromiseFulfilledResult<{ url: string; response: Response }> =>
      result.status === 'fulfilled' && result.value.response.ok,
  );
  if (available) {
    await available.value.response.body?.cancel();
    return {
      sourceId: 'chirps',
      productId: sourceById.chirps.productId,
      status: 'processing',
      endpoint: available.value.url,
      responseFormat: 'application/tiff',
      observations: [],
      retrievedAt: new Date().toISOString(),
      period: { start: query.startDate, end: query.endDate },
      spatialResolution: sourceById.chirps.spatialResolution,
      attribution: sourceById.chirps.attribution,
      message: 'CHIRPS raster access is available, but point sampling is still being processed in the server adapter.',
    };
  }

  const rootResponses = await Promise.allSettled(archivePaths.map(async (rootUrl) => ({
    rootUrl,
    response: await fetchWithTimeout(rootUrl, { cache: 'no-store' }),
  })));
  const availableRoot = rootResponses.find(
    (result): result is PromiseFulfilledResult<{ rootUrl: string; response: Response }> =>
      result.status === 'fulfilled' && result.value.response.ok,
  );
  if (availableRoot) {
    await availableRoot.value.response.body?.cancel();
    return {
      sourceId: 'chirps',
      productId: sourceById.chirps.productId,
      status: 'processing',
      endpoint: availableRoot.value.rootUrl,
      responseFormat: 'application/octet-stream',
      observations: [],
      retrievedAt: new Date().toISOString(),
      period: { start: query.startDate, end: query.endDate },
      spatialResolution: sourceById.chirps.spatialResolution,
      attribution: sourceById.chirps.attribution,
      message: 'CHIRPS archive is reachable, but this adapter requires a supported public raster access path for point extraction.',
    };
  }

  throw new UpstreamError(
    'CHIRPS public archive access is unavailable from the current environment. The fetch path returned no valid raster data for point extraction.',
    503,
    'chirps',
    'error',
  );
}

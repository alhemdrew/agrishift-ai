import { describe, expect, it } from 'vitest';
import { assessAgriculture } from './assessment';
import type { ObservationHubResult } from '@/lib/earth-data/types';

function hub(rain: number[], temperature = [31]): ObservationHubResult {
  const base = { sourceId: 'power' as const, productId: 'POWER', status: 'success' as const, endpoint: '', responseFormat: 'json', observations: [], retrievedAt: '2026-01-01T00:00:00Z', period: { start: '2026-01-01', end: '2026-01-03' }, spatialResolution: '', attribution: '' };
  return {
    retrievedAt: base.retrievedAt,
    period: base.period,
    sources: {
      power: { sourceId: 'power', availability: 'operational', status: 'success', result: { ...base, observations: [...rain.map((value, i) => ({ sourceId: 'power' as const, productId: 'POWER', variable: 'PRECTOTCORR', value, unit: 'mm/day', latitude: 10.5, longitude: 7.4, observationTime: `2026-01-0${i + 1}`, periodStart: '2026-01-01', periodEnd: '2026-01-03', spatialResolution: '', processingMetadata: {}, retrievedAt: base.retrievedAt, provenance: 'NASA', citation: 'NASA' })), ...temperature.map((value, i) => ({ sourceId: 'power' as const, productId: 'POWER', variable: 'T2M', value, unit: 'C', latitude: 10.5, longitude: 7.4, observationTime: `2026-01-0${i + 1}`, periodStart: '2026-01-01', periodEnd: '2026-01-03', spatialResolution: '', processingMetadata: {}, retrievedAt: base.retrievedAt, provenance: 'NASA', citation: 'NASA' }))] }, durationMs: 1 },
      gpm: { sourceId: 'gpm', availability: 'unavailable', status: 'error' },
      smap: { sourceId: 'smap', availability: 'unavailable', status: 'error' },
      modis: { sourceId: 'modis', availability: 'unavailable', status: 'error' },
      firms: { sourceId: 'firms', availability: 'unavailable', status: 'error' },
      soilgrids: { sourceId: 'soilgrids', availability: 'unavailable', status: 'empty' },
      chirps: { sourceId: 'chirps', availability: 'unavailable', status: 'error' },
    },
  };
}

describe('assessAgriculture', () => {
  it('does not turn a short dry window into a seasonal drought conclusion', () => {
    const result = assessAgriculture(hub([0, 0, 0]), 10.5225, 7.4389, {}, new Date('2026-01-15T00:00:00Z'));
    expect(result.risks[0]?.id).toBe('recent-dry-spell');
    expect(result.risks[0]?.limitation).toContain('short observation window');
    expect(result.crops.every((crop) => crop.status !== 'potentially_suitable')).toBe(true);
  });

  it('keeps irrigation availability distinct from rain-fed evidence', () => {
    const result = assessAgriculture(hub([1, 2, 0]), 10.5225, 7.4389, { waterSource: 'none' }, new Date('2026-01-15T00:00:00Z'));
    expect(result.missingInformation).toContain('Farm size');
    expect(result.crops.every((crop) => !crop.limitingFactors.some((factor) => factor.includes('assume irrigation')))).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/earth-data/hub', () => ({
  fetchObservationHub: vi.fn(),
  fetchObservationSource: vi.fn(),
}));

import { fetchObservationHub, fetchObservationSource } from '@/lib/earth-data/hub';
import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/earth/observations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('earth observations API validation', () => {
  it('rejects invalid coordinates before contacting providers', async () => {
    const response = await POST(request({
      sourceId: 'all',
      latitude: 91,
      longitude: 7.4,
      startDate: '2024-01-01',
      endDate: '2024-01-02',
    }));

    expect(response.status).toBe(400);
    expect(fetchObservationHub).not.toHaveBeenCalled();
  });

  it('rejects impossible dates and oversized observation windows', async () => {
    const base = {
      sourceId: 'power',
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-02',
    };
    const impossibleDate = await POST(request({ ...base, endDate: '2024-02-31' }));
    const oversizedWindow = await POST(request({ ...base, endDate: '2025-01-03' }));

    expect(impossibleDate.status).toBe(400);
    expect(oversizedWindow.status).toBe(400);
    expect(fetchObservationSource).not.toHaveBeenCalled();
  });

  it('rejects inherited object property names as source identifiers', async () => {
    const response = await POST(request({
      sourceId: 'toString',
      latitude: 10.5225,
      longitude: 7.4389,
      startDate: '2024-01-01',
      endDate: '2024-01-02',
    }));

    expect(response.status).toBe(400);
    expect(fetchObservationSource).not.toHaveBeenCalled();
  });
});

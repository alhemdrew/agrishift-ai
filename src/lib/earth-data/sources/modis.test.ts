import { afterEach, describe, expect, it, vi } from 'vitest';

const query = {
  latitude: 10.5225,
  longitude: 7.4389,
  startDate: '2024-01-01',
  endDate: '2024-01-30',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('NASA MODIS AppEEARS adapter', () => {
  it('submits a point task and reports processing without observations', async () => {
    vi.resetModules();
    const { fetchModisObservations } = await import('./modis');
    vi.stubEnv('NASA_EARTHDATA_USERNAME', 'test-user');
    vi.stubEnv('NASA_EARTHDATA_PASSWORD', 'test-password');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: 'test-appeears-token',
        token_type: 'Bearer',
        expiration: '2099-01-01T00:00:00Z',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ task_id: 'task-123' }), { status: 200 })));

    const result = await fetchModisObservations(query);

    expect(result.status).toBe('processing');
    expect(result.observations).toHaveLength(0);
    expect(result.taskId).toBe('task-123');
    expect(result.endpoint).toContain('/task');

    const [, taskRequest] = vi.mocked(fetch).mock.calls[1];
    const body = JSON.parse(String(taskRequest?.body));
    expect(body.task_type).toBe('point');
    expect(body.params.coordinates).toEqual([{ id: 'selected-location', latitude: 10.5225, longitude: 7.4389 }]);
    expect(body.params.layers).toEqual(expect.arrayContaining([
      { product: 'MOD13Q1.061', layer: '_250m_16_days_NDVI' },
    ]));
  });

  it('polls a completed task, downloads its CSV bundle, and parses dated observations', async () => {
    vi.resetModules();
    const { fetchModisObservations } = await import('./modis');
    vi.stubEnv('NASA_EARTHDATA_USERNAME', 'test-user');
    vi.stubEnv('NASA_EARTHDATA_PASSWORD', 'test-password');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: 'test-appeears-token',
        token_type: 'Bearer',
        expiration: '2099-01-01T00:00:00Z',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'done' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        files: [{ file_id: 'result.csv', file_name: 'result.csv' }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response([
        'Date,NDVI,EVI,VI Quality,Pixel Reliability',
        '2024-01-17,0.62,0.41,good,good',
      ].join('\n'), { status: 200, headers: { 'content-type': 'text/csv' } })));

    const result = await fetchModisObservations(query, 'task-123');

    expect(result.status).toBe('success');
    expect(result.observations).toHaveLength(2);
    expect(result.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        variable: 'NDVI',
        value: 0.62,
        unit: 'unitless',
        observationTime: '2024-01-17',
      }),
      expect.objectContaining({ variable: 'EVI', value: 0.41 }),
    ]));
    expect(result.observations[0].provenance).toContain('/bundle/task-123/');
  });

  it('rejects missing AppEEARS credentials without contacting the provider', async () => {
    vi.resetModules();
    const { fetchModisObservations } = await import('./modis');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(fetchModisObservations(query)).rejects.toThrow('username/password');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed completed CSV responses', async () => {
    vi.resetModules();
    const { fetchModisObservations } = await import('./modis');
    vi.stubEnv('NASA_EARTHDATA_USERNAME', 'test-user');
    vi.stubEnv('NASA_EARTHDATA_PASSWORD', 'test-password');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: 'test-appeears-token',
        token_type: 'Bearer',
        expiration: '2099-01-01T00:00:00Z',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'done' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        files: [{ file_id: 'result.csv', file_name: 'result.csv' }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Date,Value\n2024-01-17,0.5', { status: 200 })));

    await expect(fetchModisObservations(query, 'task-123')).rejects.toThrow('NDVI or EVI');
  });
});

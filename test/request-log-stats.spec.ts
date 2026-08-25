import { aggregateRequestLogStats } from '../src/modules/admin-insights/helpers/request-log-stats';

describe('aggregateRequestLogStats', () => {
  it('aggregates per-route latency and groups auth/chat separately', () => {
    const stats = aggregateRequestLogStats(
      [
        {
          method: 'GET',
          path: '/api/auth/session',
          route_group: 'auth',
          status_code: 200,
          duration_ms: 100,
          is_stream: false,
        },
        {
          method: 'GET',
          path: '/api/auth/session',
          route_group: 'auth',
          status_code: 200,
          duration_ms: 300,
          is_stream: false,
        },
        {
          method: 'POST',
          path: '/api/chats/id/messages/stream',
          route_group: 'chat',
          status_code: 201,
          duration_ms: 5000,
          is_stream: true,
        },
        {
          method: 'GET',
          path: '/api/chats',
          route_group: 'chat',
          status_code: 200,
          duration_ms: 250,
          is_stream: false,
        },
      ],
      {
        hours: 24,
        excludeStream: true,
        routeGroupFilter: null,
        limit: 10,
      },
    );

    expect(stats.routes).toHaveLength(2);
    expect(stats.routes[0]).toMatchObject({
      path: '/api/auth/session',
      routeGroup: 'auth',
      requestCount: 2,
      avgMs: 200,
      p50Ms: 200,
    });
    expect(stats.groups.map((group) => group.routeGroup)).toEqual(['auth', 'chat']);
    expect(stats.sampleCount).toBe(3);
  });

  it('filters by route group when requested', () => {
    const stats = aggregateRequestLogStats(
      [
        {
          method: 'GET',
          path: '/api/auth/me',
          route_group: 'auth',
          status_code: 200,
          duration_ms: 120,
          is_stream: false,
        },
        {
          method: 'GET',
          path: '/api/chats',
          route_group: 'chat',
          status_code: 200,
          duration_ms: 800,
          is_stream: false,
        },
      ],
      {
        hours: 24,
        excludeStream: true,
        routeGroupFilter: 'auth',
        limit: 10,
      },
    );

    expect(stats.routes).toHaveLength(1);
    expect(stats.routes[0].path).toBe('/api/auth/me');
    expect(stats.groups).toHaveLength(1);
    expect(stats.groups[0].routeGroup).toBe('auth');
  });
});

import { BadRequestException } from '@nestjs/common';
import { RequestLogsService } from '../src/modules/admin-insights/request-logs.service';
import { SupabaseAdminClientService } from '../src/modules/admin-insights/supabase-admin-client.service';

jest.mock('../src/common/request-log-sink', () => ({
  isRequestLogSinkEnabled: jest.fn(() => true),
}));

describe('RequestLogsService stats', () => {
  const rpc = jest.fn();
  const supabaseAdmin = {
    getClient: () => ({ rpc }),
  } as unknown as SupabaseAdminClientService;

  const service = new RequestLogsService(supabaseAdmin);

  beforeEach(() => {
    rpc.mockReset();
  });

  it('returns aggregated stats for the selected window', async () => {
    rpc.mockResolvedValue({
      data: {
        total: 12,
        avgDurationMs: 18.5,
        errorCount: 1,
        errorRate: 0.0833,
        byPath: [
          {
            method: 'GET',
            path: '/api/auth/session',
            count: 8,
            avg_duration_ms: 12.1,
            errors: 0,
          },
        ],
        byCallerKind: [{ caller_kind: 'guest', count: 8, avg_duration_ms: 12.1 }],
        byCallSource: [{ call_source: 'auth:api', count: 8, avg_duration_ms: 12.1 }],
      },
      error: null,
    });

    const result = await service.getStats({ window: '24h', pathSort: 'avg_duration' });
    expect(result).toEqual({
      enabled: true,
      stats: expect.objectContaining({
        window: '24h',
        total: 12,
        avgDurationMs: 18.5,
        errorCount: 1,
        errorRate: 0.0833,
        byPath: expect.any(Array),
        byCallerKind: expect.any(Array),
        byCallSource: expect.any(Array),
      }),
    });
    expect(rpc).toHaveBeenCalledWith(
      'admin_api_request_log_stats',
      expect.objectContaining({
        since_ts: expect.any(String),
        path_limit: 50,
        exclude_stream: true,
        path_sort: 'avg_duration',
        path_sort_order: 'desc',
      }),
    );
  });

  it('forwards path sort, order and limit query params', async () => {
    rpc.mockResolvedValue({
      data: {
        total: 0,
        avgDurationMs: 0,
        errorCount: 0,
        errorRate: 0,
        byPath: [],
        byCallerKind: [],
        byCallSource: [],
      },
      error: null,
    });

    await service.getStats({
      window: '7d',
      pathSort: 'max_duration',
      pathSortOrder: 'asc',
      pathLimit: 100,
      excludeStream: false,
    });

    expect(rpc).toHaveBeenCalledWith(
      'admin_api_request_log_stats',
      expect.objectContaining({
        path_limit: 100,
        exclude_stream: false,
        path_sort: 'max_duration',
        path_sort_order: 'asc',
      }),
    );
  });

  it('degrades when the stats function is missing', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function admin_api_request_log_stats does not exist' },
    });

    const result = await service.getStats({ window: '7d' });
    expect(result).toEqual({
      enabled: false,
      reason: 'stats_fn_missing',
    });
  });

  it('throws when rpc fails unexpectedly', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });

    await expect(service.getStats({ window: '30d' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

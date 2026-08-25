import { RequestLogsService } from '../src/modules/admin-insights/request-logs.service';
import { isRequestLogSinkEnabled } from '../src/common/request-log-sink';

jest.mock('../src/common/request-log-sink', () => ({
  isRequestLogSinkEnabled: jest.fn(),
}));

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };

function mockAdminClient(result: QueryResult) {
  const request = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: undefined as undefined,
  };
  Object.assign(request, result);
  return {
    getClient: () => ({
      from: jest.fn(() => request),
    }),
    request,
  };
}

describe('RequestLogsService', () => {
  const sinkEnabled = isRequestLogSinkEnabled as jest.MockedFunction<
    typeof isRequestLogSinkEnabled
  >;

  beforeEach(() => {
    sinkEnabled.mockReturnValue(true);
  });

  it('returns migration_missing only for an absent relation', async () => {
    const admin = mockAdminClient({
      data: null,
      error: { code: '42P01', message: 'relation "api_request_logs" does not exist' },
    });
    const service = new RequestLogsService(admin as never);

    await expect(service.listLogs({})).resolves.toEqual({
      enabled: false,
      reason: 'migration_missing',
    });
  });

  it('returns schema_cache when PostgREST has not reloaded the table', async () => {
    const admin = mockAdminClient({
      data: null,
      error: {
        code: 'PGRST205',
        message:
          "Could not find the table 'public.api_request_logs' in the schema cache",
      },
    });
    const service = new RequestLogsService(admin as never);

    await expect(service.listLogs({})).resolves.toEqual({
      enabled: false,
      reason: 'schema_cache',
    });
  });

  it('does not disguise permission errors as a missing migration', async () => {
    const admin = mockAdminClient({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for table api_request_logs',
      },
    });
    const service = new RequestLogsService(admin as never);

    await expect(service.listLogs({})).rejects.toMatchObject({
      response: {
        code: 'ADMIN_REQUEST_LOGS_FAILED',
        message: 'permission denied for table api_request_logs',
      },
    });
  });
});

import {
  classifyRequestLogTableError,
  isMissingRequestLogTableError,
} from '../src/common/request-log-table-error';

describe('classifyRequestLogTableError', () => {
  it('treats Postgres undefined_table as a missing migration', () => {
    expect(classifyRequestLogTableError({ code: '42P01' })).toBe('missing');
    expect(
      classifyRequestLogTableError({
        message: 'relation "public.api_request_logs" does not exist',
      }),
    ).toBe('missing');
  });

  it('treats PostgREST schema-cache misses separately from a missing table', () => {
    expect(classifyRequestLogTableError({ code: 'PGRST205' })).toBe(
      'schema_cache',
    );
    expect(
      classifyRequestLogTableError({
        message:
          "Could not find the table 'public.api_request_logs' in the schema cache",
      }),
    ).toBe('schema_cache');
  });

  it('does not treat permission or generic table-name errors as a missing table', () => {
    expect(
      classifyRequestLogTableError({
        code: '42501',
        message: 'permission denied for table api_request_logs',
      }),
    ).toBeNull();
    expect(
      isMissingRequestLogTableError({
        message: 'insert into api_request_logs failed',
      }),
    ).toBe(false);
  });
});

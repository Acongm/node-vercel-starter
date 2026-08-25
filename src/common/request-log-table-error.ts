export type RequestLogTableIssue = 'missing' | 'schema_cache';

type PostgrestLikeError = {
  code?: string;
  message?: string;
};

const SCHEMA_CACHE_PATTERN =
  /could not find the table ['"]public\.api_request_logs['"]/i;
const MISSING_RELATION_PATTERN =
  /relation ["']?(public\.)?api_request_logs["']? does not exist/i;

export function classifyRequestLogTableError(
  error: PostgrestLikeError,
): RequestLogTableIssue | null {
  if (error.code === 'PGRST205') {
    return 'schema_cache';
  }
  if (error.code === '42P01') {
    return 'missing';
  }

  const message = error.message ?? '';
  if (SCHEMA_CACHE_PATTERN.test(message)) {
    return 'schema_cache';
  }
  if (MISSING_RELATION_PATTERN.test(message)) {
    return 'missing';
  }
  return null;
}

export function isMissingRequestLogTableError(
  error: PostgrestLikeError,
): boolean {
  return classifyRequestLogTableError(error) !== null;
}

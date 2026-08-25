import { BadRequestException, Injectable } from '@nestjs/common';
import { isRequestLogSinkEnabled } from '../../common/request-log-sink';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { ListRequestLogsDto } from './dto/request-logs.dto';

export interface RequestLogRow {
  id: number;
  request_id: string | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  user_id: string | null;
  client_id: string | null;
  call_source: string | null;
  caller_kind: string | null;
  origin: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('api_request_logs'))
  );
}

@Injectable()
export class RequestLogsService {
  constructor(private readonly supabaseAdmin: SupabaseAdminClientService) {}

  async listLogs(query: ListRequestLogsDto) {
    if (!isRequestLogSinkEnabled()) {
      return { enabled: false as const };
    }

    const client = this.supabaseAdmin.getClient();
    const limit = query.limit ?? 100;

    let request = client
      .from('api_request_logs')
      .select('*')
      .order('id', { ascending: false })
      .limit(limit);

    if (query.sinceId) {
      request = request.gt('id', query.sinceId);
    }
    if (query.path) {
      const pattern = `%${escapeIlike(query.path)}%`;
      request = request.ilike('path', pattern);
    }
    if (query.status !== undefined) {
      request = request.eq('status_code', query.status);
    }

    const { data, error } = await request;
    if (error) {
      if (isMissingTableError(error)) {
        return {
          enabled: false as const,
          reason: 'migration_missing' as const,
        };
      }
      throw new BadRequestException({
        code: 'ADMIN_REQUEST_LOGS_FAILED',
        message: error.message,
      });
    }

    return {
      enabled: true as const,
      items: (data ?? []) as RequestLogRow[],
    };
  }
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

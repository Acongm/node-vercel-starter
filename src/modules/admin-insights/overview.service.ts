import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { isRequestLogSinkEnabled } from '../../common/request-log-sink';
import { AppConfig } from '../../config/app-config';
import { SupabaseAdminClientService } from './supabase-admin-client.service';

export interface SyncJobSummary {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
  finished_at: string | null;
}

@Injectable()
export class OverviewService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminClientService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getOverview() {
    const [
      chatsCount,
      messagesCount,
      chatLogs24hCount,
      kbAnalysisCount,
      kbChunksCount,
      latestSyncJob,
      requestLogErrorRate24h,
      chatLogsTodayCount,
    ] = await Promise.all([
      this.countTable('chats'),
      this.countTable('messages'),
      this.countChatLogsSince(hoursAgoIso(24)),
      this.countTable('kb_analysis'),
      this.countTable('kb_chunks'),
      this.fetchLatestSyncJob(),
      this.fetchRequestLogErrorRate24h(),
      this.countChatLogsSince(startOfTodayIso()),
    ]);

    return {
      chatsCount,
      messagesCount,
      chatLogs24hCount,
      kbAnalysisCount,
      kbChunksCount,
      latestSyncJob,
      requestLogErrorRate24h,
      chatLogsTodayCount,
    };
  }

  private async countTable(table: string): Promise<number | null> {
    try {
      const client = this.supabaseAdmin.getClient();
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        return null;
      }

      return count ?? 0;
    } catch {
      return null;
    }
  }

  private async countChatLogsSince(sinceIso: string): Promise<number | null> {
    try {
      const client = this.supabaseAdmin.getClient();
      const table = this.config.supabase.chatLogsTable;
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sinceIso);

      if (error) {
        return null;
      }

      return count ?? 0;
    } catch {
      return null;
    }
  }

  private async fetchLatestSyncJob(): Promise<SyncJobSummary | null> {
    try {
      const client = this.supabaseAdmin.getClient();
      const { data, error } = await client
        .from('sync_jobs')
        .select('id, job_type, status, created_at, finished_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data as SyncJobSummary;
    } catch {
      return null;
    }
  }

  private async fetchRequestLogErrorRate24h(): Promise<number | null> {
    if (!isRequestLogSinkEnabled()) {
      return null;
    }

    try {
      const client = this.supabaseAdmin.getClient();
      const sinceIso = hoursAgoIso(24);

      const [totalResult, errorResult] = await Promise.all([
        client
          .from('api_request_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sinceIso),
        client
          .from('api_request_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sinceIso)
          .gte('status_code', 500),
      ]);

      if (totalResult.error || errorResult.error) {
        return null;
      }

      const total = totalResult.count ?? 0;
      if (total === 0) {
        return 0;
      }

      const errors = errorResult.count ?? 0;
      return errors / total;
    } catch {
      return null;
    }
  }
}

function hoursAgoIso(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function startOfTodayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { normalizeCitationUrl } from './helpers/citation-url';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import {
  KbUsageQueryDto,
  ListKbAnalysisDto,
  ListKbChunksDto,
  ListKbFailuresDto,
  ListKbJobsDto,
} from './dto/kb-admin.dto';

export interface SyncJobRow {
  id: string;
  job_type: string;
  status: string;
  trigger_source: string;
  payload: unknown;
  result: unknown;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncFailureRow {
  id: string;
  job_id: string | null;
  path: string | null;
  failure_code: string;
  reason: string;
  context: unknown;
  retry_count: number;
  next_retry_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface KbAnalysisRow {
  id: string;
  path: string;
  title: string | null;
  summary: string | null;
  keywords: unknown;
  difficulty: string | null;
  content_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbChunkRow {
  id: string;
  path: string;
  chunk_index: number;
  content: string;
  heading: string | null;
  token_count: number | null;
  created_at: string;
}

interface ChatLogContextRow {
  context: Record<string, unknown> | null;
  sources: unknown;
  created_at: string;
}

export interface CoverageAggregate {
  path: string;
  chunkCount: number;
  tokenSum: number;
}

export interface CountAggregate {
  key: string;
  count: number;
}

@Injectable()
export class KbAdminService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminClientService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listJobs(query: ListKbJobsDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = client
      .from('sync_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      request = request.eq('status', query.status);
    }
    if (query.jobType) {
      request = request.eq('job_type', query.jobType);
    }

    const { data, error, count } = await request;
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_KB_JOBS_FAILED',
        message: error.message,
      });
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as SyncJobRow[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async listFailures(query: ListKbFailuresDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await client
      .from('sync_failures')
      .select('*', { count: 'exact' })
      .order('resolved_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_KB_FAILURES_FAILED',
        message: error.message,
      });
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as SyncFailureRow[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async listAnalysis(query: ListKbAnalysisDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = client
      .from('kb_analysis')
      .select(
        'id, path, title, summary, keywords, difficulty, content_type, created_at, updated_at',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: false })
      .range(from, to);

    const search = query.search?.trim();
    if (search) {
      const pattern = `%${escapeIlike(search)}%`;
      request = request.or(`path.ilike.${pattern},title.ilike.${pattern}`);
    }

    const { data, error, count } = await request;
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_KB_ANALYSIS_FAILED',
        message: error.message,
      });
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as KbAnalysisRow[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async listChunks(query: ListKbChunksDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = client
      .from('kb_chunks')
      .select('id, path, chunk_index, content, heading, token_count, created_at', {
        count: 'exact',
      })
      .order('chunk_index', { ascending: true })
      .range(from, to);

    if (query.path) {
      request = request.eq('path', query.path);
    }

    const { data, error, count } = await request;
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_KB_CHUNKS_FAILED',
        message: error.message,
      });
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as KbChunkRow[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getUsage(query: KbUsageQueryDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const days = query.days ?? 30;
    const limit = query.limit ?? 20;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [coverage, chatPages, citations] = await Promise.all([
      this.aggregateCoverage(limit),
      this.aggregateChatPages(since.toISOString(), limit),
      this.aggregateCitations(since.toISOString(), limit),
    ]);

    return { coverage, chatPages, citations, days, limit };
  }

  private async aggregateCoverage(limit: number): Promise<CoverageAggregate[]> {
    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client
      .from('kb_chunks')
      .select('path, token_count')
      .limit(10000);

    if (error) {
      return [];
    }

    const byPath = new Map<string, CoverageAggregate>();
    for (const row of (data ?? []) as Array<{ path: string; token_count: number | null }>) {
      const existing = byPath.get(row.path) ?? {
        path: row.path,
        chunkCount: 0,
        tokenSum: 0,
      };
      existing.chunkCount += 1;
      existing.tokenSum += row.token_count ?? 0;
      byPath.set(row.path, existing);
    }

    return [...byPath.values()]
      .sort((a, b) => b.chunkCount - a.chunkCount)
      .slice(0, limit);
  }

  private async aggregateChatPages(
    sinceIso: string,
    limit: number,
  ): Promise<CountAggregate[]> {
    const client = this.supabaseAdmin.getClient();
    const table = this.config.supabase.chatLogsTable;
    const { data, error } = await client
      .from(table)
      .select('context, created_at')
      .gte('created_at', sinceIso)
      .limit(5000);

    if (error) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as ChatLogContextRow[]) {
      const pagePath =
        row.context && typeof row.context.pagePath === 'string'
          ? row.context.pagePath
          : undefined;
      if (!pagePath) {
        continue;
      }
      counts.set(pagePath, (counts.get(pagePath) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private async aggregateCitations(
    sinceIso: string,
    limit: number,
  ): Promise<CountAggregate[]> {
    const client = this.supabaseAdmin.getClient();
    const table = this.config.supabase.chatLogsTable;
    const { data, error } = await client
      .from(table)
      .select('sources, created_at')
      .gte('created_at', sinceIso)
      .limit(5000);

    if (error) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as ChatLogContextRow[]) {
      if (!Array.isArray(row.sources)) {
        continue;
      }

      for (const source of row.sources) {
        if (!isSourceWithUrl(source)) {
          continue;
        }
        const normalized = normalizeCitationUrl(source.url);
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

function isSourceWithUrl(value: unknown): value is { url: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof (value as { url: unknown }).url === 'string'
  );
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

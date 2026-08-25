export interface PortalSummaryEntry {
  summary?: string;
  keyPoints?: string[];
  keywords?: string[];
  techStack?: string[];
  difficulty?: string;
  contentType?: string;
}

export interface PortalFileEntry {
  sourceHash?: string;
  analysisHash?: string;
  status?: string;
  summary?: PortalSummaryEntry | null;
}

export interface PortalSnapshot {
  version?: string;
  generatedAt?: string;
  analysis?: {
    model?: string;
    promptVersion?: string;
    extractVersion?: string;
  };
  stats?: {
    totalFiles?: number;
    reusedFiles?: number;
    pendingFiles?: number;
    completedFiles?: number;
    skippedFiles?: number;
    failedFiles?: number;
    aiCalls?: number;
    hitRate?: number;
    durationMs?: number;
  };
  files?: Record<string, PortalFileEntry>;
}

export interface PortalAnalysisRow {
  id: string;
  path: string;
  title: string | null;
  summary: string | null;
  key_points: string[];
  keywords: string[];
  tech_stack: string[];
  difficulty: string | null;
  content_type: string | null;
  status: string | null;
  updated_at: string | null;
  source: 'portal-static';
}

export function titleFromPath(path: string): string {
  const segment = path.split('/').pop() ?? path;
  return segment.replace(/\.mdx?$/i, '');
}

export function mapSnapshotToAnalysisRows(snapshot: PortalSnapshot): PortalAnalysisRow[] {
  const generatedAt = snapshot.generatedAt ?? null;
  const files = snapshot.files ?? {};

  return Object.entries(files).map(([path, entry]) => {
    const summaryObj = entry.summary;
    return {
      id: path,
      path,
      title: titleFromPath(path),
      summary: summaryObj?.summary ?? null,
      key_points: summaryObj?.keyPoints ?? [],
      keywords: summaryObj?.keywords ?? [],
      tech_stack: summaryObj?.techStack ?? [],
      difficulty: summaryObj?.difficulty ?? null,
      content_type: summaryObj?.contentType ?? null,
      status: entry.status ?? null,
      updated_at: generatedAt,
      source: 'portal-static' as const,
    };
  });
}

export function filterAnalysisRows(
  rows: PortalAnalysisRow[],
  search?: string,
): PortalAnalysisRow[] {
  const term = search?.trim().toLowerCase();
  if (!term) {
    return rows;
  }

  return rows.filter((row) => {
    const haystack = [row.path, row.summary ?? '', row.title ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const total = rows.length;
  const from = (page - 1) * pageSize;
  const items = rows.slice(from, from + pageSize);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function synthesizePortalJob(snapshot: PortalSnapshot): SyncJobRowFromPortal {
  const generatedAt = snapshot.generatedAt ?? new Date().toISOString();
  const stats = snapshot.stats ?? {};
  const durationMs = stats.durationMs ?? 0;
  const startedAt = new Date(new Date(generatedAt).getTime() - durationMs).toISOString();

  return {
    id: 'portal-latest',
    job_type: 'pipeline',
    status: 'succeeded',
    trigger_source: 'vercel-build',
    payload: snapshot.analysis ?? {},
    result: stats,
    error: null,
    started_at: startedAt,
    finished_at: generatedAt,
    created_at: generatedAt,
    updated_at: generatedAt,
    source: 'portal-static',
  };
}

export interface SyncJobRowFromPortal {
  id: string;
  job_type: string;
  status: string;
  trigger_source: string;
  payload: unknown;
  result: unknown;
  error: string | null;
  started_at: string;
  finished_at: string;
  created_at: string;
  updated_at: string;
  source: 'portal-static';
}

export function parsePortalSnapshot(raw: unknown): PortalSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as PortalSnapshot;
}

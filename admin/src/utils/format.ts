export function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return String(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function formatDurationMs(
  startedAt: string | null,
  finishedAt: string | null,
): string {
  if (!startedAt || !finishedAt) {
    return '-';
  }
  const started = new Date(startedAt).getTime();
  const finished = new Date(finishedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(finished)) {
    return '-';
  }
  const diff = finished - started;
  if (diff < 0) {
    return '-';
  }
  return `${diff} ms`;
}

export function idPrefix(value: string | null | undefined, length = 8): string {
  if (!value) {
    return '-';
  }
  return value.slice(0, length);
}

export function statusTagColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'succeeded' || normalized === 'completed' || normalized === 'success') {
    return 'success';
  }
  if (normalized === 'failed' || normalized === 'error') {
    return 'error';
  }
  if (normalized === 'running' || normalized === 'in_progress') {
    return 'processing';
  }
  if (normalized === 'pending') {
    return 'default';
  }
  return 'default';
}

export function httpStatusTagColor(statusCode: number): string {
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warning';
  }
  if (statusCode >= 200 && statusCode < 300) {
    return 'success';
  }
  return 'default';
}

export function roleTagColor(role: string): string {
  if (role === 'admin') {
    return 'gold';
  }
  if (role === 'editor') {
    return 'blue';
  }
  return 'default';
}

export function parseKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function parseSources(value: unknown): Array<{ url?: string; title?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      url: typeof item.url === 'string' ? item.url : undefined,
      title: typeof item.title === 'string' ? item.title : undefined,
    }));
}

export function getMessageModel(metadata: unknown): string | undefined {
  if (typeof metadata !== 'object' || metadata === null) {
    return undefined;
  }
  const model = (metadata as { model?: unknown }).model;
  return typeof model === 'string' ? model : undefined;
}

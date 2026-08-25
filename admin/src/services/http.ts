import type { ApiResult } from '@/types';

export async function apiFetch(
  url: string,
  options?: RequestInit,
): Promise<ApiResult> {
  const started = performance.now();
  const headers = new Headers(options?.headers);

  let body = options?.body;
  if (body !== undefined && !(body instanceof FormData)) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (typeof body !== 'string') {
      body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
    body,
  });

  const durationMs = Math.round(performance.now() - started);
  const contentType = response.headers.get('content-type') || '';

  let parsed: unknown;
  if (response.status === 204) {
    parsed = null;
  } else if (contentType.includes('application/json')) {
    parsed = await response.json();
  } else if (contentType.startsWith('text/')) {
    parsed = await response.text();
  } else {
    const blob = await response.blob();
    parsed = `[binary ${blob.type || 'unknown'} ${blob.size} bytes]`;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs,
    body: parsed,
  };
}

export function formatApiResult(result: ApiResult): string {
  return [
    `HTTP ${result.status} ${result.statusText}`,
    `Duration: ${result.durationMs}ms`,
    '',
    typeof result.body === 'string'
      ? result.body
      : JSON.stringify(result.body, null, 2),
  ].join('\n');
}

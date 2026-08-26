import type { ApiResult } from '../types';

function messageFromBody(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }
  if (!body || typeof body !== 'object') {
    return null;
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }
  if (Array.isArray(message)) {
    const parts = message.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    if (parts.length > 0) {
      return parts.join('; ');
    }
  }
  return null;
}

export function formatApiError(result: ApiResult, fallback: string): string {
  return messageFromBody(result.body) ?? `${fallback}: HTTP ${result.status}`;
}

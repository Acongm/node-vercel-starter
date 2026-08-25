/** Normalize citation URLs by stripping fragments and utm_* tracking params. */
export function normalizeCitationUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  url.hash = '';

  const keysToDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (key.toLowerCase().startsWith('utm_')) {
      keysToDelete.push(key);
    }
  });
  for (const key of keysToDelete) {
    url.searchParams.delete(key);
  }

  const normalized = url.toString();
  return normalized.endsWith('?') ? normalized.slice(0, -1) : normalized;
}

export const SAFE_PRO_TABLE_FORM = {
  syncToUrl: false,
} as const;

export function buildDataTablePath(tableKey: string): string {
  return `/data?table=${encodeURIComponent(tableKey)}`;
}

export function parseDataTableKey(
  pathOrSearch: string,
  routeTableKey?: string,
): string {
  if (routeTableKey?.trim()) {
    return routeTableKey.trim();
  }

  try {
    const url = new URL(pathOrSearch, 'https://api.acongm.com');
    return url.searchParams.get('table')?.trim() || '';
  } catch {
    return '';
  }
}

export function preventNativeSubmit(event: {
  preventDefault(): void;
  stopPropagation(): void;
}) {
  event.preventDefault();
  event.stopPropagation();
}

export function preventNativeNavigation(event: { preventDefault(): void }) {
  event.preventDefault();
}

export function stringParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

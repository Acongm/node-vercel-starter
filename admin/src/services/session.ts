const TOKEN_KEY = 'api_admin_token';

export const DEFAULT_LOGIN_URL =
  'https://auth.acongm.com/login?return_to=https%3A%2F%2Fapi.acongm.com%2F';

export interface SessionUser {
  id: string | null;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  role?: string;
}

export interface AuthSession {
  authenticated: boolean;
  isAdmin: boolean;
  role?: string;
  loginUrl: string;
  user: SessionUser | null;
  accessToken?: string | null;
}

export function readAdminToken(): string | undefined {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function writeAdminToken(token: string | undefined): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
      return;
    }
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore quota / private mode.
  }
}

export function authHeaders(): Record<string, string> {
  const token = readAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; statusText: string; durationMs: number; body: T | string }> {
  const started = performance.now();
  const headers = new Headers(options.headers);
  const token = readAdminToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  });
  const durationMs = Math.round(performance.now() - started);
  const contentType = response.headers.get('content-type') || '';
  let body: T | string;
  if (response.status === 204) {
    body = '' as T;
  } else if (contentType.includes('application/json')) {
    body = (await response.json()) as T;
  } else {
    body = await response.text();
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs,
    body,
  };
}

export async function fetchSession(): Promise<AuthSession> {
  const result = await fetchJson<AuthSession>('/api/auth/session');
  if (!result.ok || typeof result.body === 'string') {
    return {
      authenticated: false,
      isAdmin: false,
      loginUrl: DEFAULT_LOGIN_URL,
      user: null,
    };
  }
  return {
    authenticated: Boolean(result.body.authenticated),
    isAdmin: Boolean(result.body.isAdmin),
    role: result.body.role,
    loginUrl: result.body.loginUrl || DEFAULT_LOGIN_URL,
    user: result.body.user,
    accessToken: result.body.accessToken,
  };
}

export function buildAuthLoginUrl(returnTo = window.location.href): string {
  const url = new URL('/login', 'https://auth.acongm.com');
  url.searchParams.set('return_to', returnTo);
  return url.toString();
}

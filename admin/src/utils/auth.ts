const AUTH_BASE =
  process.env.AUTH_BASE_URL?.trim() || 'https://auth.acongm.com';

export function getAuthLoginUrl(returnTo?: string): string {
  const url = new URL('/login', AUTH_BASE);
  if (returnTo) {
    url.searchParams.set('return_to', returnTo);
  }
  return url.toString();
}

export function redirectToLogin(): void {
  const returnTo =
    typeof window !== 'undefined' ? window.location.href : undefined;
  window.location.href = getAuthLoginUrl(returnTo);
}

export function redirectToLogout(): void {
  const returnTo =
    typeof window !== 'undefined' ? window.location.origin : undefined;
  const url = new URL('/logout', AUTH_BASE);
  if (returnTo) {
    url.searchParams.set('return_to', returnTo);
  }
  window.location.href = url.toString();
}

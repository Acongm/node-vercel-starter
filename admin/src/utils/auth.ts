const AUTH_BASE =
  process.env.AUTH_BASE_URL?.trim() || 'https://auth.acongm.com';

const FE_BASE_PATH = '/fe';

export function getFeBaseUrl(): string {
  if (typeof window === 'undefined') {
    return `https://api.acongm.com${FE_BASE_PATH}`;
  }
  return `${window.location.origin}${FE_BASE_PATH}`;
}

export function getFeDashboardUrl(): string {
  return `${getFeBaseUrl()}/dashboard`;
}

export function getAuthLoginUrl(returnTo?: string): string {
  const url = new URL('/login', AUTH_BASE);
  if (returnTo) {
    url.searchParams.set('return_to', returnTo);
  }
  return url.toString();
}

export function redirectToLogin(): void {
  const returnTo =
    typeof window !== 'undefined' ? window.location.href : getFeDashboardUrl();
  window.location.href = getAuthLoginUrl(returnTo);
}

export function redirectToLogout(): void {
  const returnTo = getFeBaseUrl();
  const url = new URL('/logout', AUTH_BASE);
  url.searchParams.set('return_to', returnTo);
  window.location.href = url.toString();
}

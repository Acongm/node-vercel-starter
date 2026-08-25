export const DEFAULT_ADMIN_EMAILS = [
  'o.arvin.peng@gmail.com',
  'acongm@126.com',
] as const;

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAdminEmails(raw?: string): string[] {
  const extras = (raw ?? '')
    .split(',')
    .map((item) => normalizeAdminEmail(item))
    .filter(Boolean);

  return [...new Set([...DEFAULT_ADMIN_EMAILS.map(normalizeAdminEmail), ...extras])];
}

export function isAdminEmail(
  email: string | undefined,
  adminEmails: readonly string[] = DEFAULT_ADMIN_EMAILS,
): boolean {
  if (!email) {
    return false;
  }
  const normalized = normalizeAdminEmail(email);
  return adminEmails.some((item) => normalizeAdminEmail(item) === normalized);
}

export function applyAdminEmailRole<T extends string>(
  role: T,
  email: string | undefined,
  adminEmails: readonly string[] = DEFAULT_ADMIN_EMAILS,
): T | 'admin' {
  return isAdminEmail(email, adminEmails) ? 'admin' : role;
}

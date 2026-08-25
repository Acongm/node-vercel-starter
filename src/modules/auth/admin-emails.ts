/** Built-in platform admin emails (lowercase). Override via AUTH_ADMIN_EMAILS. */
export const DEFAULT_ADMIN_EMAILS = [
  'o.arvin.peng@gmail.com',
  'acongm@126.com',
] as const;

export function parseAdminEmails(raw: string | undefined): string[] {
  const fromEnv = (raw || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const merged = new Set<string>([...DEFAULT_ADMIN_EMAILS, ...fromEnv]);
  return [...merged];
}

export function isAdminEmail(
  email: string | undefined,
  adminEmails: readonly string[],
): boolean {
  if (!email?.trim()) {
    return false;
  }
  return adminEmails.includes(email.trim().toLowerCase());
}

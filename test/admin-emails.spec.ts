import {
  DEFAULT_ADMIN_EMAILS,
  applyAdminEmailRole,
  isAdminEmail,
  parseAdminEmails,
} from '../src/modules/auth/admin-emails';
import { loadAppConfig } from '../src/config/app-config';

describe('admin email whitelist', () => {
  it('treats the built-in operators as admins', () => {
    expect(isAdminEmail('o.arvin.peng@gmail.com')).toBe(true);
    expect(isAdminEmail('Acongm@126.com')).toBe(true);
    expect(isAdminEmail(' viewer@acongm.com ')).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it('always keeps the default whitelist when parsing extras', () => {
    const emails = parseAdminEmails('ops@acongm.com, o.arvin.peng@gmail.com');
    expect(emails).toEqual(
      expect.arrayContaining([
        ...DEFAULT_ADMIN_EMAILS,
        'ops@acongm.com',
      ]),
    );
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('elevates a viewer role when the email is whitelisted', () => {
    expect(
      applyAdminEmailRole('viewer', 'acongm@126.com', DEFAULT_ADMIN_EMAILS),
    ).toBe('admin');
    expect(
      applyAdminEmailRole('editor', 'someone@example.com', DEFAULT_ADMIN_EMAILS),
    ).toBe('editor');
  });

  it('loads AUTH_ADMIN_EMAILS into app config without dropping defaults', () => {
    const config = loadAppConfig({
      AUTH_ADMIN_EMAILS: 'ops@acongm.com',
    });
    expect(config.auth.adminEmails).toEqual(
      expect.arrayContaining(['o.arvin.peng@gmail.com', 'acongm@126.com', 'ops@acongm.com']),
    );
  });
});

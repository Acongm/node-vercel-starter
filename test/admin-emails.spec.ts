import { isAdminEmail, parseAdminEmails } from '../src/modules/auth/admin-emails';

describe('admin-emails', () => {
  it('includes built-in whitelist emails', () => {
    const emails = parseAdminEmails(undefined);
    expect(emails).toEqual(
      expect.arrayContaining([
        'o.arvin.peng@gmail.com',
        'acongm@126.com',
      ]),
    );
  });

  it('merges env overrides without duplicates', () => {
    const emails = parseAdminEmails('Admin@Example.com, o.arvin.peng@gmail.com');
    expect(emails).toEqual(
      expect.arrayContaining([
        'o.arvin.peng@gmail.com',
        'acongm@126.com',
        'admin@example.com',
      ]),
    );
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('matches emails case-insensitively', () => {
    expect(
      isAdminEmail('O.ArVin.Peng@Gmail.com', parseAdminEmails(undefined)),
    ).toBe(true);
    expect(isAdminEmail('viewer@example.com', parseAdminEmails(undefined))).toBe(
      false,
    );
  });
});

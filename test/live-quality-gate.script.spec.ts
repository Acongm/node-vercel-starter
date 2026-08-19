import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const script = readFileSync(
  join(process.cwd(), 'scripts/live-quality-gate.mjs'),
  'utf8',
);

describe('live quality gate cookie probes (#37)', () => {
  it('proves session with acongm_access_token when Bearer is absent', () => {
    expect(script).toContain('Cookie: `acongm_access_token=');
    expect(script).toContain('${API_BASE}/api/auth/session');
  });

  it('proves user info with the Supabase SSR cookie', () => {
    expect(script).toContain('sb-ejprvntpxlyydkzsjqnv-auth-token=');
    expect(script).toContain('${API_BASE}/api/user/info');
    expect(script).toContain('acongmAccessToken: true');
    expect(script).toContain('supabaseAuthToken: true');
  });
});

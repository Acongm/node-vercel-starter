import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const hasLiveSecret = Boolean(
  process.env.ACONGM_SUPABASE_ACCESS_TOKEN?.trim() &&
    process.env.LIVE_QUALITY_GATE === '1',
);

describe('Platform v2 live quality gate (#37 JWT path)', () => {
  const testFn = hasLiveSecret ? it : it.skip;

  testFn('probes production session, user, and chats with a real JWT', () => {
    const script = join(process.cwd(), 'scripts/live-quality-gate.mjs');
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: process.env,
      timeout: 60_000,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout.trim().split('\n').at(-1) || '{}');
    expect(payload.ok).toBe(true);
    expect(payload.session).toEqual({ authenticated: true, isAnonymous: false });
    expect(payload.chats).toEqual({ listed: expect.any(Number), created: true, deleted: true });
  });
});

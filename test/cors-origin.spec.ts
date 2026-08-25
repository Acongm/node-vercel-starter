import { isCorsOriginAllowed } from '../src/runtime/configure-app';

describe('CORS origin allowlist', () => {
  const allowed = ['https://acongm.com', 'https://*.acongm.com'];

  it('allows production acongm hosts and local admin loopback', () => {
    expect(isCorsOriginAllowed('https://api.acongm.com', allowed)).toBe(true);
    expect(isCorsOriginAllowed('https://www.acongm.com', allowed)).toBe(true);
    expect(isCorsOriginAllowed('http://127.0.0.1:3000', allowed)).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:8000', allowed)).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example', allowed)).toBe(false);
  });
});

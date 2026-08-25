import { inferCallSource } from '../src/common/infer-request-log-meta';

describe('inferCallSource', () => {
  it('prefers the explicit x-call-source header', () => {
    expect(
      inferCallSource({
        header: 'portal:ci:summaries',
        origin: 'https://www.acongm.com',
        path: '/api/chats',
      }),
    ).toBe('portal:ci:summaries');
  });

  it('infers portal and auth origins', () => {
    expect(
      inferCallSource({
        origin: 'https://www.acongm.com',
        path: '/api/user/info',
      }),
    ).toBe('portal:web');
    expect(
      inferCallSource({
        origin: 'https://auth.acongm.com',
        path: '/api/auth/session',
      }),
    ).toBe('auth:web');
  });

  it('falls back to path-based api namespaces', () => {
    expect(
      inferCallSource({
        path: '/api/auth/session',
      }),
    ).toBe('auth:api');
    expect(
      inferCallSource({
        path: '/api/admin/overview',
      }),
    ).toBe('admin:api');
    expect(
      inferCallSource({
        path: '/v1/chat/completions',
      }),
    ).toBe('chat:api');
  });

  it('returns unknown when no signal is available', () => {
    expect(
      inferCallSource({
        path: '/api/health',
      }),
    ).toBe('unknown');
  });
});

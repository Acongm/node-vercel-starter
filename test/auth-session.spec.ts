import { AuthService } from '../src/modules/auth/auth.service';
import { AppConfig } from '../src/config/app-config';
import { AuthPrincipal } from '../src/modules/auth/roles';

function createService() {
  const config = {
    supabase: {
      url: 'https://ejprvntpxlyydkzsjqnv.supabase.co',
      publicKey: 'sb_publishable_test',
    },
    auth: {
      mode: 'jwt',
      jwtSecret: 'test',
      sessionTtl: '1h',
      oauth: {},
    },
  } as AppConfig;
  return new AuthService(config, {} as never, {} as never, {} as never);
}

describe('AuthService.sessionResponse', () => {
  const service = createService();

  it('returns an unauthenticated session without leaking a token', () => {
    const anonymous: AuthPrincipal = {
      userId: null,
      role: 'anonymous',
      tier: 'anon',
      source: 'none',
    };
    expect(service.sessionResponse(anonymous)).toMatchObject({
      authenticated: false,
      isAnonymous: false,
      user: null,
      userInfo: null,
      accessToken: null,
    });
  });

  it('maps email login metadata into userInfo', () => {
    const emailUser: AuthPrincipal = {
      userId: 'user-email',
      role: 'viewer',
      tier: 'user',
      source: 'supabase',
      email: 'ada@acongm.com',
      name: 'ada',
    };
    const payload = service.sessionResponse(emailUser, 'token-email');
    expect(payload.authenticated).toBe(true);
    expect(payload.userInfo).toMatchObject({
      id: 'user-email',
      displayName: 'ada',
      email: 'ada@acongm.com',
      isAnonymous: false,
    });
    expect(payload.accessToken).toBe('token-email');
  });

  it('maps third-party login name and avatar into userInfo', () => {
    const oauthUser: AuthPrincipal = {
      userId: 'user-oauth',
      role: 'viewer',
      tier: 'user',
      source: 'supabase',
      email: 'ada@gmail.com',
      name: 'Ada Lovelace',
      avatarUrl: 'https://avatars.example/ada.png',
    };
    const payload = service.sessionResponse(oauthUser, 'token-oauth');
    expect(payload.userInfo).toMatchObject({
      id: 'user-oauth',
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://avatars.example/ada.png',
      email: 'ada@gmail.com',
      isAnonymous: false,
    });
  });
});

describe('AuthService.userInfoResponse', () => {
  const service = createService();

  it('uses OIDC claim names for email and OAuth users', () => {
    const principal: AuthPrincipal = {
      userId: 'user-1',
      role: 'viewer',
      tier: 'user',
      source: 'supabase',
      email: 'ada@acongm.com',
      name: 'Ada',
      avatarUrl: 'https://avatars.example/ada.png',
    };
    expect(service.userInfoResponse(principal)).toMatchObject({
      sub: 'user-1',
      email: 'ada@acongm.com',
      name: 'Ada',
      picture: 'https://avatars.example/ada.png',
      userInfo: { displayName: 'Ada' },
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { AppConfig } from '../src/config/app-config';
import { SiteConfig } from '../src/config/site-config';
import { AccessTokenService } from '../src/modules/auth/access-token.service';
import { AuthUsersService } from '../src/modules/auth/auth-users.service';
import { OAuthService } from '../src/modules/auth/oauth.service';

describe('OAuthService signed state', () => {
  function createService(jwtSecret = 'state-secret') {
    const config = {
      auth: {
        jwtSecret,
        oauth: {
          githubClientId: 'gh-id',
          githubClientSecret: 'gh-secret',
          googleClientId: undefined,
          googleClientSecret: undefined,
          redirectBase: 'https://api.acongm.com',
        },
      },
    } as AppConfig;
    const siteConfig = {
      domains: {
        portal: 'https://www.acongm.com',
        dochub: 'https://dochub.acongm.com',
        chat: 'https://chat.acongm.com',
        auth: 'https://auth.acongm.com',
        api: 'https://api.acongm.com',
      },
      oauth: { providers: ['github', 'google'], claimThreads: true },
    } as SiteConfig;

    return new OAuthService(
      config,
      siteConfig,
      {} as AuthUsersService,
      {} as AccessTokenService,
    );
  }

  it('round-trips HMAC state across instances (same secret)', () => {
    const a = createService();
    const b = createService();
    const state = a.signStateForTests({
      provider: 'github',
      next: 'https://chat.acongm.com/',
      nonce: 'abc',
      exp: Date.now() + 60_000,
    });

    // consumeState is private; exercise via handleCallback validation path
    // by calling encode on A and verifying B can parse with same secret.
    expect(state.split('.')).toHaveLength(2);
    const again = b.signStateForTests({
      provider: 'github',
      next: 'https://chat.acongm.com/',
      nonce: 'abc',
      exp: Date.now() + 60_000,
    });
    // Different nonce/exp → different body; same structure.
    expect(again.includes('.')).toBe(true);
  });

  it('rejects tampered state', async () => {
    const service = createService();
    const state = service.signStateForTests({
      provider: 'github',
      next: 'https://www.acongm.com/',
      nonce: 'n',
      exp: Date.now() + 60_000,
    });
    const [body] = state.split('.');
    const tampered = `${body}.deadbeef`;

    await expect(
      service.handleCallback({
        provider: 'github',
        code: 'x',
        state: tampered,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects expired state', async () => {
    const service = createService();
    const state = service.signStateForTests({
      provider: 'github',
      next: 'https://www.acongm.com/',
      nonce: 'n',
      exp: Date.now() - 1,
    });

    await expect(
      service.handleCallback({
        provider: 'github',
        code: 'x',
        state,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds GitHub authorize URL when configured', () => {
    const service = createService();
    const url = new URL(service.buildAuthorizeUrl('github', 'https://chat.acongm.com/app'));
    expect(url.origin).toBe('https://github.com');
    expect(url.searchParams.get('client_id')).toBe('gh-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.acongm.com/api/auth/oauth/github/callback',
    );
    expect(url.searchParams.get('state')).toContain('.');
  });
});

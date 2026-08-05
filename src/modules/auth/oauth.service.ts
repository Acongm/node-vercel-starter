import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { APP_CONFIG, SITE_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { SiteConfig } from '../../config/site-config';
import { AccessTokenService } from './access-token.service';
import { AuthUsersService } from './auth-users.service';

export type OAuthProviderName = 'github' | 'google';

interface OAuthStatePayload {
  provider: OAuthProviderName;
  next: string;
  nonce: string;
  exp: number;
}

@Injectable()
export class OAuthService {
  private readonly pendingStates = new Map<string, OAuthStatePayload>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(SITE_CONFIG) private readonly siteConfig: SiteConfig,
    private readonly users: AuthUsersService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  listProviders() {
    const authApiBase = this.oauthCallbackBase();
    const configured = this.siteConfig.oauth?.providers?.length
      ? this.siteConfig.oauth.providers
      : (['github', 'google'] as OAuthProviderName[]);

    return {
      authBase: this.siteConfig.domains.auth.replace(/\/+$/, ''),
      apiBase: this.siteConfig.domains.api.replace(/\/+$/, ''),
      claimThreads: this.siteConfig.oauth?.claimThreads ?? true,
      providers: configured.map((id) => {
        const enabled = this.isProviderConfigured(id);
        return {
          id,
          name: id === 'github' ? 'GitHub' : 'Google',
          enabled,
          /** Prefer API-hosted OAuth when client secrets are configured. */
          loginUrl: enabled
            ? `${authApiBase}/api/auth/oauth/${id}/start`
            : `${this.siteConfig.domains.auth.replace(/\/+$/, '')}/login?provider=${id}`,
          authorizePath: `/api/auth/oauth/${id}/start`,
        };
      }),
    };
  }

  isProviderConfigured(provider: OAuthProviderName): boolean {
    if (provider === 'github') {
      return Boolean(
        this.config.auth.oauth.githubClientId &&
          this.config.auth.oauth.githubClientSecret,
      );
    }
    return Boolean(
      this.config.auth.oauth.googleClientId &&
        this.config.auth.oauth.googleClientSecret,
    );
  }

  buildAuthorizeUrl(provider: OAuthProviderName, next?: string): string {
    if (!this.isProviderConfigured(provider)) {
      throw new ServiceUnavailableException(
        `${provider} OAuth is not configured. Set AUTH_${provider.toUpperCase()}_CLIENT_ID/SECRET.`,
      );
    }

    const state = this.createState(provider, next);
    const redirectUri = this.callbackUri(provider);

    if (provider === 'github') {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', this.config.auth.oauth.githubClientId!);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return url.toString();
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.config.auth.oauth.googleClientId!);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async handleCallback(input: {
    provider: OAuthProviderName;
    code?: string;
    state?: string;
  }) {
    if (!input.code || !input.state) {
      throw new BadRequestException('Missing OAuth code or state.');
    }
    const state = this.consumeState(input.state);
    if (state.provider !== input.provider) {
      throw new BadRequestException('OAuth state provider mismatch.');
    }

    const profile =
      input.provider === 'github'
        ? await this.exchangeGitHub(input.code)
        : await this.exchangeGoogle(input.code);

    const user = await this.users.upsertOAuthUser({
      provider: input.provider,
      providerUserId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });

    const session = await this.accessTokens.issueForUser(user);
    return {
      ...session,
      next: state.next,
    };
  }

  async exchangeCode(input: {
    provider: OAuthProviderName;
    code: string;
    redirectUri?: string;
  }) {
    if (!this.isProviderConfigured(input.provider)) {
      throw new ServiceUnavailableException(
        `${input.provider} OAuth is not configured.`,
      );
    }

    const profile =
      input.provider === 'github'
        ? await this.exchangeGitHub(input.code, input.redirectUri)
        : await this.exchangeGoogle(input.code, input.redirectUri);

    const user = await this.users.upsertOAuthUser({
      provider: input.provider,
      providerUserId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });

    return this.accessTokens.issueForUser(user);
  }

  buildFrontendRedirect(next: string, accessToken: string): string {
    const url = new URL(next);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('token_type', 'Bearer');
    return url.toString();
  }

  private oauthCallbackBase(): string {
    return (
      this.config.auth.oauth.redirectBase ||
      this.siteConfig.domains.api
    ).replace(/\/+$/, '');
  }

  private callbackUri(provider: OAuthProviderName): string {
    return `${this.oauthCallbackBase()}/api/auth/oauth/${provider}/callback`;
  }

  private createState(provider: OAuthProviderName, next?: string): string {
    const fallback = this.siteConfig.domains.portal;
    const safeNext = this.sanitizeNext(next, fallback);
    const nonce = randomBytes(16).toString('hex');
    const payload: OAuthStatePayload = {
      provider,
      next: safeNext,
      nonce,
      exp: Date.now() + 10 * 60 * 1000,
    };
    const state = randomBytes(24).toString('hex');
    this.pendingStates.set(state, payload);
    return state;
  }

  private consumeState(state: string): OAuthStatePayload {
    const payload = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    if (!payload || payload.exp < Date.now()) {
      throw new BadRequestException('Invalid or expired OAuth state.');
    }
    return payload;
  }

  private sanitizeNext(next: string | undefined, fallback: string): string {
    if (!next) return fallback;
    try {
      const url = new URL(next, fallback);
      const host = url.hostname;
      const allowed = ['acongm.com', 'localhost', '127.0.0.1'].some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`),
      );
      return allowed ? url.toString() : fallback;
    } catch {
      return fallback;
    }
  }

  private async exchangeGitHub(code: string, redirectUri?: string) {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.auth.oauth.githubClientId,
          client_secret: this.config.auth.oauth.githubClientSecret,
          code,
          redirect_uri: redirectUri || this.callbackUri('github'),
        }),
      },
    );
    const tokenJson = (await tokenResponse.json()) as {
      access_token?: string;
      error_description?: string;
    };
    if (!tokenJson.access_token) {
      throw new BadRequestException(
        tokenJson.error_description || 'GitHub token exchange failed.',
      );
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${tokenJson.access_token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'acongm-api',
      },
    });
    const user = (await userResponse.json()) as {
      id?: number;
      login?: string;
      name?: string;
      email?: string | null;
      avatar_url?: string;
    };

    let email = user.email || undefined;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          authorization: `Bearer ${tokenJson.access_token}`,
          accept: 'application/vnd.github+json',
          'user-agent': 'acongm-api',
        },
      });
      const emails = (await emailsResponse.json()) as Array<{
        email: string;
        primary?: boolean;
        verified?: boolean;
      }>;
      email =
        emails.find((item) => item.primary && item.verified)?.email ||
        emails.find((item) => item.verified)?.email ||
        emails[0]?.email;
    }

    if (!user.id || !email) {
      throw new BadRequestException('GitHub profile is missing id/email.');
    }

    return {
      id: String(user.id),
      email,
      name: user.name || user.login || email,
      avatarUrl: user.avatar_url,
    };
  }

  private async exchangeGoogle(code: string, redirectUri?: string) {
    const body = new URLSearchParams({
      code,
      client_id: this.config.auth.oauth.googleClientId || '',
      client_secret: this.config.auth.oauth.googleClientSecret || '',
      redirect_uri: redirectUri || this.callbackUri('google'),
      grant_type: 'authorization_code',
    });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tokenJson = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
      error_description?: string;
    };
    if (!tokenJson.access_token) {
      throw new BadRequestException(
        tokenJson.error_description || 'Google token exchange failed.',
      );
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { authorization: `Bearer ${tokenJson.access_token}` },
      },
    );
    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new BadRequestException('Google profile is missing sub/email.');
    }

    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.picture,
    };
  }
}

/** Deterministic helper exported for tests. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

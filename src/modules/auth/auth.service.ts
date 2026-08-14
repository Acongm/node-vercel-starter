import {
  Inject,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AccessTokenService } from './access-token.service';
import { AdminSessionService } from './admin-session.service';
import { AuthUsersService } from './auth-users.service';
import { LoginDto } from './dto/login.dto';
import { resolveUserInfo } from '../user/user-info';
import { AuthPrincipal } from './roles';

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly adminSession: AdminSessionService,
    private readonly users: AuthUsersService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  /**
   * Browser-safe Supabase publishable config. Never includes service_role.
   * Chat/Portal fetch this when NEXT_PUBLIC_SUPABASE_* was not baked at build.
   */
  publicConfig() {
    const supabaseUrl = this.config.supabase.url?.trim() || null;
    const supabaseAnonKey = this.config.supabase.publicKey?.trim() || null;
    return {
      supabaseUrl,
      supabaseAnonKey,
      configured: Boolean(supabaseUrl && supabaseAnonKey),
    };
  }

  mode() {
    const adminConfigured = this.adminSession.isConfigured();
    const oauth = this.config.auth.oauth;
    return {
      authMode: adminConfigured ? 'jwt' : this.config.auth.mode,
      adminLoginConfigured: adminConfigured,
      localLoginEnabled: true,
      registrationOpen: false,
      supabaseJwtConfigured: Boolean(this.config.auth.supabaseJwtSecret),
      oauthConfigured: {
        github: Boolean(oauth.githubClientId && oauth.githubClientSecret),
        google: Boolean(oauth.googleClientId && oauth.googleClientSecret),
      },
      roles: ['anonymous', 'viewer', 'editor', 'admin'],
      tiers: ['anon', 'user'],
      note:
        'Password login: admin env credentials or seeded local users (registration is closed). OAuth: GET /api/auth/oauth/providers. Supabase JWT uses SUPABASE_JWT_SECRET + app_metadata.role.',
    };
  }

  async login(dto: LoginDto) {
    if (this.config.auth.mode === 'external') {
      throw new NotImplementedException(
        'AUTH_MODE=external should use OAuth (/api/auth/oauth/...) or your identity provider.',
      );
    }

    const identifier = (dto.email || dto.username || '').trim();
    const password = dto.password || '';

    if (
      this.adminSession.isConfigured() &&
      this.adminSession.validateCredentials(identifier, password)
    ) {
      return this.adminSession.login(identifier, password);
    }

    if (identifier && password) {
      const user = await this.users.authenticateLocal(identifier, password);
      if (user) {
        return this.accessTokens.issueForUser(user);
      }
    }

    if (this.adminSession.isConfigured() || identifier) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const user = {
      id: dto.username || 'anonymous',
      name: dto.username || 'Anonymous',
      roles: this.config.auth.mode === 'none' ? ['anonymous'] : ['user'],
      role: this.config.auth.mode === 'none' ? 'anonymous' : 'viewer',
      tier: this.config.auth.mode === 'none' ? 'anon' : 'user',
    };

    if (this.config.auth.mode === 'none') {
      return { authMode: 'none', user };
    }

    throw new UnauthorizedException(
      'Login requires a seeded local account, AUTH_ADMIN_* credentials, or OAuth.',
    );
  }

  principalResponse(principal: AuthPrincipal) {
    const authenticated = principal.tier === 'user';
    return {
      authenticated,
      role: principal.role,
      tier: principal.tier,
      source: principal.source,
      user: authenticated
        ? {
            id: principal.userId,
            name: principal.name,
            email: principal.email,
            role: principal.role,
            roles: [principal.role],
            tier: principal.tier,
          }
        : {
            id: null,
            name: 'Anonymous',
            role: 'anonymous',
            roles: ['anonymous'],
            tier: 'anon',
          },
    };
  }

  /**
   * Keycloak-like session check. Email and OAuth both resolve through the
   * same principal (cookie or Bearer). Does not require public-config.
   */
  sessionResponse(principal: AuthPrincipal, accessToken?: string | null) {
    const publicConfig = this.publicConfig();
    const authenticated = principal.tier === 'user' && Boolean(principal.userId);
    const userInfo =
      principal.userId && principal.source === 'supabase'
        ? resolveUserInfo(principal, null)
        : null;

    return {
      authenticated,
      configured: publicConfig.configured,
      isAnonymous: principal.tier === 'anon' && Boolean(principal.userId),
      user: principal.userId
        ? {
            id: principal.userId,
            email: principal.email ?? null,
            name: principal.name ?? null,
            avatarUrl: principal.avatarUrl ?? null,
          }
        : null,
      userInfo,
      accessToken: accessToken ?? null,
    };
  }

  /** OIDC-style userinfo: same identity for email and third-party login. */
  userInfoResponse(principal: AuthPrincipal) {
    if (!principal.userId) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Missing Supabase access token.',
      });
    }
    return {
      sub: principal.userId,
      email: principal.email ?? null,
      name: principal.name ?? null,
      picture: principal.avatarUrl ?? null,
      userInfo: resolveUserInfo(principal, null),
    };
  }
}

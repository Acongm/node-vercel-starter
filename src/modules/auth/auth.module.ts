import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MemoryDataStore } from '../../adapters/data-store/memory-data-store';
import { FileDataStore } from '../../adapters/data-store/file-data-store';
import { UnsupportedDataStore } from '../../adapters/data-store/unsupported-data-store';
import {
  SupabaseDataStore,
  SupabaseRow,
} from '../../adapters/data-store/supabase-data-store';
import { CreateEntityInput } from '../../adapters/data-store/data-store.interface';
import { APP_CONFIG, AUTH_USER_STORE } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AccessTokenService } from './access-token.service';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminSessionService } from './admin-session.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  AuthProvider,
  AuthUserRecord,
} from './auth-user-record';
import { AuthUsersService } from './auth-users.service';
import { JwtAuthService } from './jwt-auth.service';
import { OAuthService } from './oauth.service';
import { OptionalAuthGuard, RolesGuard } from './roles.guard';
import { PlatformRole } from './roles';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseRequestClientService } from './supabase-request-client.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminSessionService,
    AdminSessionGuard,
    JwtAuthService,
    SupabaseAuthService,
    SupabaseRequestClientService,
    AccessTokenService,
    AuthUsersService,
    OAuthService,
    RolesGuard,
    OptionalAuthGuard,
    {
      provide: AUTH_USER_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createAuthUserStore(config),
    },
  ],
  exports: [
    AdminSessionService,
    AdminSessionGuard,
    JwtAuthService,
    SupabaseAuthService,
    SupabaseRequestClientService,
    AccessTokenService,
    AuthUsersService,
    OAuthService,
    RolesGuard,
    OptionalAuthGuard,
  ],
})
export class AuthModule {}

function createAuthUserStore(config: AppConfig) {
  switch (config.dataMode) {
    case 'none':
    case 'memory':
      return new MemoryDataStore<AuthUserRecord>();
    case 'file':
      return new FileDataStore<AuthUserRecord>(config.authUsersFilePath);
    case 'supabase':
      if (!config.supabase.url || !config.supabase.apiKey) {
        throw new Error(
          'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
        );
      }
      return new SupabaseDataStore<AuthUserRecord>({
        table: config.supabase.authUsersTable,
        url: config.supabase.url,
        apiKey: config.supabase.apiKey,
        requestSecret: config.supabase.requestSecret,
        fromRow: authUserFromRow,
        toRow: authUserToRow,
      });
    default:
      return new UnsupportedDataStore<AuthUserRecord>(config.dataMode);
  }
}

function authUserFromRow(row: SupabaseRow): AuthUserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    username: row.username ? String(row.username) : undefined,
    passwordHash: row.password_hash ? String(row.password_hash) : undefined,
    provider: String(row.provider) as AuthProvider,
    providerUserId: row.provider_user_id
      ? String(row.provider_user_id)
      : undefined,
    role: String(row.role) as Exclude<PlatformRole, 'anonymous'>,
    name: row.name ? String(row.name) : undefined,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    disabled: Boolean(row.disabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
  };
}

function authUserToRow(
  input: Partial<CreateEntityInput<AuthUserRecord>>,
): SupabaseRow {
  return {
    email: input.email,
    username: input.username,
    password_hash: input.passwordHash,
    provider: input.provider,
    provider_user_id: input.providerUserId,
    role: input.role,
    name: input.name,
    avatar_url: input.avatarUrl,
    disabled: input.disabled ?? false,
  };
}

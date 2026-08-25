import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { PlatformRole } from '../auth/roles';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { ListLocalUsersDto, ListPlatformUsersDto } from './dto/users-admin.dto';

export interface AuthUserRow {
  id: string;
  email: string;
  username: string | null;
  provider: string;
  provider_user_id: string | null;
  role: string;
  name: string | null;
  avatar_url: string | null;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformUserItem {
  id: string;
  email?: string;
  providers: string[];
  role: PlatformRole;
  isAnonymous: boolean;
  createdAt?: string;
  lastSignInAt?: string;
}

@Injectable()
export class UsersAdminService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminClientService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listPlatformUsers(query: ListPlatformUsersDto) {
    if (!this.supabaseAdmin.hasAdminAuth()) {
      return {
        enabled: false as const,
        reason:
          'Supabase service role key is required for auth.admin.listUsers. Set SUPABASE_SERVICE_ROLE_KEY.',
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 50;

    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_USERS_LIST_FAILED',
        message: error.message,
      });
    }

    const items = (data.users ?? []).map(mapPlatformUser);
    return {
      enabled: true as const,
      items,
      page,
      perPage,
      total: data.total ?? items.length,
    };
  }

  async listLocalUsers(query: ListLocalUsersDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const table = this.config.supabase.authUsersTable;

    const { data, error, count } = await client
      .from(table)
      .select(
        'id, email, username, provider, provider_user_id, role, name, avatar_url, disabled, created_at, updated_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_LOCAL_USERS_FAILED',
        message: error.message,
      });
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as AuthUserRow[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}

function mapPlatformUser(user: User): PlatformUserItem {
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? (user.app_metadata as Record<string, unknown>)
      : {};

  const roleValue =
    (typeof appMetadata.platform_role === 'string' && appMetadata.platform_role) ||
    (typeof appMetadata.role === 'string' && appMetadata.role) ||
    'viewer';

  const providers = new Set<string>();
  if (typeof appMetadata.provider === 'string') {
    providers.add(appMetadata.provider);
  }
  for (const identity of user.identities ?? []) {
    if (identity.provider) {
      providers.add(identity.provider);
    }
  }

  return {
    id: user.id,
    email: user.email,
    providers: [...providers],
    role: roleValue as PlatformRole,
    isAnonymous: Boolean(user.is_anonymous),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? undefined,
  };
}

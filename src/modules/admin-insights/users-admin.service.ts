import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { PlatformRole } from '../auth/roles';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { ListLocalUsersDto, ListPlatformUsersDto } from './dto/users-admin.dto';
import {
  classifyAnonymousUsers,
  selectPurgeGhostIds,
  type AnonymousActivity,
} from './helpers/anonymous-identity';

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
  cid?: string;
  hasChats?: boolean;
  isGhost?: boolean;
}

const LIST_USERS_PER_PAGE = 200;
const MAX_LIST_USER_PAGES = 5;
const MAX_EMAIL_SEARCH_PAGES = 5;
const CHAT_USER_ID_SCAN_LIMIT = 5000;

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

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const wantAnonymous = query.anonymous === 'true';
    const emailQuery = query.q?.trim().toLowerCase();

    if (wantAnonymous) {
      const allUsers = await this.listAuthUsersUpTo(MAX_LIST_USER_PAGES);
      return this.listAnonymousUsers({
        users: allUsers,
        page,
        pageSize,
        q: query.q,
        activity: query.activity ?? 'active',
      });
    }

    if (emailQuery) {
      const allUsers = await this.listAuthUsersUpTo(MAX_EMAIL_SEARCH_PAGES);
      const filtered = allUsers
        .filter((user) => !user.is_anonymous)
        .filter((user) => (user.email ?? '').toLowerCase().includes(emailQuery));
      const total = filtered.length;
      const from = (page - 1) * pageSize;
      const pageUsers = filtered.slice(from, from + pageSize);
      return {
        enabled: true as const,
        items: pageUsers.map((user) => mapPlatformUser(user)),
        total,
        page,
        pageSize,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        ghostCount: 0,
        activeCount: 0,
      };
    }

    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_USERS_LIST_FAILED',
        message: error.message,
      });
    }

    const pageUsers = (data.users ?? []).filter((user) => !user.is_anonymous);
    const items = pageUsers.map((user) => mapPlatformUser(user));

    return {
      enabled: true as const,
      items,
      total: pageUsers.length,
      page,
      pageSize,
      totalPages: pageUsers.length < pageSize ? page : page + 1,
      ghostCount: 0,
      activeCount: 0,
      totalApproximate: true as const,
    };
  }

  async purgeGhostUsers(options?: { dryRun?: boolean }) {
    if (!this.supabaseAdmin.hasAdminAuth()) {
      return {
        enabled: false as const,
        reason:
          'Supabase service role key is required for auth.admin.deleteUser. Set SUPABASE_SERVICE_ROLE_KEY.',
      };
    }

    const client = this.supabaseAdmin.getClient();
    const users = await this.listAuthUsersUpTo(MAX_LIST_USER_PAGES);
    const chatUserIds = await this.loadChatUserIds();
    const ids = selectPurgeGhostIds(users, {
      chatUserIds,
      nowMs: Date.now(),
    });

    if (options?.dryRun) {
      return {
        enabled: true as const,
        dryRun: true as const,
        deleted: 0,
        skipped: 0,
        candidateCount: ids.length,
        ids,
      };
    }

    let deleted = 0;
    let skipped = 0;
    for (const id of ids) {
      const { error } = await client.auth.admin.deleteUser(id);
      if (error) {
        skipped += 1;
        continue;
      }
      deleted += 1;
    }

    return {
      enabled: true as const,
      dryRun: false as const,
      deleted,
      skipped,
      candidateCount: ids.length,
      ids,
    };
  }

  private async listAnonymousUsers(input: {
    users: User[];
    page: number;
    pageSize: number;
    q?: string;
    activity: AnonymousActivity;
  }) {
    const chatUserIds = await this.loadChatUserIds();
    const classified = classifyAnonymousUsers(input.users, {
      chatUserIds,
      activity: input.activity,
      nowMs: Date.now(),
      q: input.q,
    });

    const total = classified.items.length;
    const from = (input.page - 1) * input.pageSize;
    const pageUsers = classified.items.slice(from, from + input.pageSize);
    const items = pageUsers.map((user) =>
      mapPlatformUser(user, {
        cid: user.cid,
        hasChats: user.hasChats,
        isGhost: user.isGhost,
      }),
    );

    return {
      enabled: true as const,
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
      ghostCount: classified.ghostCount,
      activeCount: classified.activeCount,
    };
  }

  private async listAuthUsersUpTo(maxPages: number): Promise<User[]> {
    const client = this.supabaseAdmin.getClient();
    const allUsers: User[] = [];
    for (let listPage = 1; listPage <= maxPages; listPage += 1) {
      const { data, error } = await client.auth.admin.listUsers({
        page: listPage,
        perPage: LIST_USERS_PER_PAGE,
      });
      if (error) {
        throw new BadRequestException({
          code: 'ADMIN_USERS_LIST_FAILED',
          message: error.message,
        });
      }
      const batch = data.users ?? [];
      allUsers.push(...batch);
      if (batch.length < LIST_USERS_PER_PAGE) {
        break;
      }
    }
    return allUsers;
  }

  private async listAllAuthUsers(): Promise<User[]> {
    return this.listAuthUsersUpTo(MAX_LIST_USER_PAGES);
  }

  private async loadChatUserIds(): Promise<Set<string>> {
    const client = this.supabaseAdmin.getClient();
    const ids = new Set<string>();
    const pageSize = 1000;
    let from = 0;

    while (ids.size < CHAT_USER_ID_SCAN_LIMIT) {
      const { data, error } = await client
        .from('chats')
        .select('user_id')
        .range(from, from + pageSize - 1);
      if (error) {
        throw new BadRequestException({
          code: 'ADMIN_CHAT_USER_IDS_FAILED',
          message: error.message,
        });
      }
      const rows = (data ?? []) as Array<{ user_id?: string | null }>;
      for (const row of rows) {
        if (row.user_id) ids.add(row.user_id);
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return ids;
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

function mapPlatformUser(
  user: User,
  extras?: { cid?: string; hasChats?: boolean; isGhost?: boolean },
): PlatformUserItem {
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
    cid: extras?.cid,
    hasChats: extras?.hasChats,
    isGhost: extras?.isGhost,
  };
}

import { Injectable } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import {
  ResolvedUserIdentity,
  UserEmailCache,
} from './helpers/user-email-cache';
import { SupabaseAdminClientService } from './supabase-admin-client.service';

@Injectable()
export class UserIdentityService {
  private readonly cache = new UserEmailCache();

  constructor(private readonly supabaseAdmin: SupabaseAdminClientService) {}

  async resolveUser(userId: string | null | undefined): Promise<ResolvedUserIdentity | undefined> {
    if (!userId) {
      return undefined;
    }

    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    if (!this.supabaseAdmin.hasAdminAuth()) {
      return undefined;
    }

    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return undefined;
    }

    const identity = mapSupabaseUser(data.user);
    this.cache.set(userId, identity);
    return identity;
  }

  async resolveMany(userIds: string[]): Promise<Map<string, ResolvedUserIdentity>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, ResolvedUserIdentity>();

    await Promise.all(
      uniqueIds.map(async (userId) => {
        const identity = await this.resolveUser(userId);
        if (identity) {
          result.set(userId, identity);
        }
      }),
    );

    return result;
  }
}

function mapSupabaseUser(user: User): ResolvedUserIdentity {
  return {
    email: user.email ?? undefined,
    isAnonymous: Boolean(user.is_anonymous),
  };
}

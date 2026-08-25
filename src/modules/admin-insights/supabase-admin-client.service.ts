import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';

@Injectable()
export class SupabaseAdminClientService {
  private client: SupabaseClient | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isConfigured(): boolean {
    const { url, serviceRoleKey, apiKey } = this.config.supabase;
    return Boolean(url && (serviceRoleKey || apiKey));
  }

  hasAdminAuth(): boolean {
    const { url, serviceRoleKey } = this.config.supabase;
    return Boolean(url && serviceRoleKey);
  }

  unavailableReason(): string {
    return 'Supabase is not configured for admin insights. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.';
  }

  getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }

    const { url, serviceRoleKey, apiKey, requestSecret } = this.config.supabase;
    const key = serviceRoleKey || apiKey;

    if (!url || !key) {
      throw new ServiceUnavailableException(this.unavailableReason());
    }

    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: requestSecret
        ? {
            headers: {
              'x-api-secret': requestSecret,
            },
          }
        : undefined,
    });

    return this.client;
  }
}

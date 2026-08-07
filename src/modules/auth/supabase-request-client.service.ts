import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { extractBearerToken } from './bearer-token';

@Injectable()
export class SupabaseRequestClientService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  create(request: Request): SupabaseClient {
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Missing Supabase access token.',
      });
    }

    const url = this.config.supabase.url;
    const key = this.config.supabase.publicKey || this.config.supabase.apiKey;
    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or a compatible API key) are required.',
      );
    }

    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
}

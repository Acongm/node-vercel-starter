import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AuthPrincipal } from '../auth/roles';
import { SupabaseAuthService } from '../auth/supabase-auth.service';

export interface ChatOwnershipTransferResult {
  chatsTransferred: number;
  messagesTransferred: number;
  runsTransferred: number;
}

type TransferRow = {
  chats_transferred?: number | string | null;
  messages_transferred?: number | string | null;
  runs_transferred?: number | string | null;
};

function parseBearer(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function numeric(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

@Injectable()
export class ChatOwnershipTransferService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  async transfer(
    destination: AuthPrincipal,
    sourceAuthorization: string | undefined,
  ): Promise<ChatOwnershipTransferResult> {
    if (destination.tier === 'anon') {
      throw new ForbiddenException({
        code: 'DESTINATION_MUST_BE_PERMANENT',
        message: 'Chat ownership can only be transferred to a permanent user.',
      });
    }

    const sourceToken = parseBearer(sourceAuthorization);
    if (!sourceToken) {
      throw new UnauthorizedException({
        code: 'ANONYMOUS_TOKEN_REQUIRED',
        message: 'Missing anonymous Supabase access token.',
      });
    }

    const source = await this.supabaseAuth.verifyAccessToken(sourceToken);
    if (!source?.userId) {
      throw new UnauthorizedException({
        code: 'INVALID_ANONYMOUS_TOKEN',
        message: 'Invalid or expired anonymous Supabase access token.',
      });
    }

    if (source.tier !== 'anon') {
      throw new ForbiddenException({
        code: 'SOURCE_MUST_BE_ANONYMOUS',
        message: 'The source principal must be an anonymous Supabase user.',
      });
    }

    if (source.userId === destination.userId) {
      return {
        chatsTransferred: 0,
        messagesTransferred: 0,
        runsTransferred: 0,
      };
    }

    const url = this.config.supabase.url;
    const serviceRoleKey = this.config.supabase.serviceRoleKey;
    if (!url || !serviceRoleKey) {
      throw new ServiceUnavailableException({
        code: 'OWNERSHIP_TRANSFER_UNAVAILABLE',
        message: 'Supabase service-role ownership transfer is not configured.',
      });
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await admin.rpc('transfer_chat_ownership', {
      p_source_user_id: source.userId,
      p_destination_user_id: destination.userId,
    });

    if (error) {
      throw new ServiceUnavailableException({
        code: 'OWNERSHIP_TRANSFER_FAILED',
        message: 'Failed to transfer anonymous chat ownership.',
      });
    }

    const row = (Array.isArray(data) ? data[0] : data) as TransferRow | null;
    return {
      chatsTransferred: numeric(row?.chats_transferred),
      messagesTransferred: numeric(row?.messages_transferred),
      runsTransferred: numeric(row?.runs_transferred),
    };
  }
}

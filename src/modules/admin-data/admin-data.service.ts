import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import {
  ADMIN_TABLE_DEFINITIONS,
  AdminTableDefinition,
  resolveAdminTable,
} from './admin-tables';
import { ListAdminTableDto } from './dto/list-admin-table.dto';

type AdminTableRow = Record<string, unknown>;

@Injectable()
export class AdminDataService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  listTables(): AdminTableDefinition[] {
    return ADMIN_TABLE_DEFINITIONS;
  }

  async listRows(tableKey: string, query: ListAdminTableDto) {
    const definition = resolveAdminTable(tableKey);
    if (!definition) {
      throw new NotFoundException(`Unknown admin table: ${tableKey}`);
    }

    const client = this.getServiceClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = client
      .from(definition.table)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    const search = query.search?.trim();
    if (search) {
      request = this.applySearch(request, definition, search);
    }

    const { data, error, count } = await request;
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_TABLE_QUERY_FAILED',
        message: error.message,
        table: definition.table,
      });
    }

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      table: definition,
      items: (data ?? []) as AdminTableRow[],
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getRow(tableKey: string, id: string) {
    const definition = resolveAdminTable(tableKey);
    if (!definition) {
      throw new NotFoundException(`Unknown admin table: ${tableKey}`);
    }

    const client = this.getServiceClient();
    const idColumn = this.resolveIdColumn(definition);
    const { data, error } = await client
      .from(definition.table)
      .select('*')
      .eq(idColumn, id)
      .maybeSingle();

    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_TABLE_QUERY_FAILED',
        message: error.message,
        table: definition.table,
      });
    }

    if (!data) {
      throw new NotFoundException(`Row not found in ${definition.table}.`);
    }

    return {
      table: definition,
      item: data as AdminTableRow,
    };
  }

  private getServiceClient() {
    const { url, apiKey } = this.config.supabase;
    if (!url || !apiKey) {
      throw new ServiceUnavailableException(
        'Supabase service role is required for admin data browsing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    return createClient(url, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: this.config.supabase.requestSecret
        ? {
            headers: {
              'x-api-secret': this.config.supabase.requestSecret,
            },
          }
        : undefined,
    });
  }

  private resolveIdColumn(definition: AdminTableDefinition): string {
    if (definition.table === 'chat_client_labels') {
      return 'client_id';
    }
    if (definition.table === 'user_settings') {
      return 'user_id';
    }
    return 'id';
  }

  private applySearch(
    request: ReturnType<ReturnType<typeof createClient>['from']>,
    definition: AdminTableDefinition,
    search: string,
  ) {
    const pattern = `%${search.replace(/[%_]/g, '\\$&')}%`;

    switch (definition.table) {
      case 'comments':
        return request.or(`author.ilike.${pattern},content.ilike.${pattern}`);
      case 'chat_logs':
        return request.or(
          `endpoint.ilike.${pattern},model.ilike.${pattern},client_id.ilike.${pattern}`,
        );
      case 'auth_users':
        return request.or(`email.ilike.${pattern},username.ilike.${pattern}`);
      case 'chat_client_labels':
        return request.or(`client_id.ilike.${pattern},label.ilike.${pattern}`);
      case 'chat_threads':
        return request.or(`title.ilike.${pattern},user_id.ilike.${pattern}`);
      case 'chat_messages':
        return request.or(`role.ilike.${pattern},content.ilike.${pattern}`);
      default:
        return request;
    }
  }
}

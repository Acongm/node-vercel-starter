import { createClient } from '@supabase/supabase-js';
import {
  CreateEntityInput,
  DataStore,
  EntityRecord,
} from './data-store.interface';

export type SupabaseRow = Record<string, unknown>;

type SupabaseError = {
  message: string;
  code?: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type SupabaseListResult<T> = {
  data: T[] | null;
  error: SupabaseError | null;
};

export interface SupabaseTableQuery {
  select(columns?: string): SupabaseTableQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<SupabaseListResult<SupabaseRow>>;
  eq(column: string, value: string): SupabaseTableQuery;
  insert(input: SupabaseRow): SupabaseTableQuery;
  update(input: SupabaseRow): SupabaseTableQuery;
  delete(): SupabaseTableQuery;
  single(): Promise<SupabaseResult<SupabaseRow>>;
  maybeSingle(): Promise<SupabaseResult<SupabaseRow>>;
}

export interface SupabaseClientLike {
  from(table: string): SupabaseTableQuery;
}

export interface SupabaseClientOptions {
  auth: {
    autoRefreshToken: boolean;
    persistSession: boolean;
  };
  global?: {
    headers?: Record<string, string>;
  };
}

export type SupabaseClientFactory = (
  url: string,
  apiKey: string,
  options: SupabaseClientOptions,
) => SupabaseClientLike;

export interface SupabaseDataStoreOptions<T extends EntityRecord> {
  table: string;
  url?: string;
  apiKey?: string;
  serviceRoleKey?: string;
  requestSecret?: string;
  client?: SupabaseClientLike;
  clientFactory?: SupabaseClientFactory;
  fromRow: (row: SupabaseRow) => T;
  toRow: (input: Partial<CreateEntityInput<T>>) => SupabaseRow;
}

export class SupabaseDataStore<T extends EntityRecord> implements DataStore<T> {
  private readonly client: SupabaseClientLike;

  constructor(private readonly options: SupabaseDataStoreOptions<T>) {
    if (options.client) {
      this.client = options.client;
      return;
    }

    const apiKey = options.apiKey || options.serviceRoleKey;
    if (!options.url || !apiKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
      );
    }

    const clientOptions: SupabaseClientOptions = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: options.requestSecret
        ? {
            headers: {
              'x-api-secret': options.requestSecret,
            },
          }
        : undefined,
    };

    const clientFactory =
      options.clientFactory ??
      ((url, key, createOptions) =>
        createClient(url, key, createOptions) as unknown as SupabaseClientLike);

    this.client = clientFactory(options.url, apiKey, clientOptions);
  }

  async list(): Promise<T[]> {
    const result = await this.client
      .from(this.options.table)
      .select('*')
      .order('created_at', { ascending: false });

    this.throwIfError('list', result.error);
    return (result.data ?? []).map(this.options.fromRow);
  }

  async get(id: string): Promise<T | null> {
    const result = await this.client
      .from(this.options.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    this.throwIfError('get', result.error);
    return result.data ? this.options.fromRow(result.data) : null;
  }

  async create(input: CreateEntityInput<T>): Promise<T> {
    const result = await this.client
      .from(this.options.table)
      .insert(stripUndefined(this.options.toRow(input)))
      .select('*')
      .single();

    this.throwIfError('create', result.error);
    if (!result.data) {
      throw new Error(`Supabase create on ${this.options.table} returned no row.`);
    }

    return this.options.fromRow(result.data);
  }

  async update(
    id: string,
    patch: Partial<CreateEntityInput<T>>,
  ): Promise<T | null> {
    const result = await this.client
      .from(this.options.table)
      .update(stripUndefined(this.options.toRow(patch)))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    this.throwIfError('update', result.error);
    return result.data ? this.options.fromRow(result.data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client
      .from(this.options.table)
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    this.throwIfError('delete', result.error);
    return Boolean(result.data);
  }

  private throwIfError(operation: string, error: SupabaseError | null): void {
    if (error) {
      throw new Error(
        `Supabase ${operation} on ${this.options.table} failed: ${error.message}`,
      );
    }
  }
}

function stripUndefined(row: SupabaseRow): SupabaseRow {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined),
  );
}

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

type FetchLike = typeof fetch;

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
    fetch?: FetchLike;
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
  fetch?: FetchLike;
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
      global: {
        fetch: createSupabaseFetch(options.fetch),
        ...(options.requestSecret
          ? {
              headers: {
                'x-api-secret': options.requestSecret,
              },
            }
          : {}),
      },
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

const SUPABASE_FETCH_TIMEOUT_MS = 4_000;
const SUPABASE_READ_RETRIES = 1;
const SUPABASE_RETRY_DELAY_MS = 100;

function createSupabaseFetch(baseFetch = globalThis.fetch.bind(globalThis)): FetchLike {
  return async (input, init) => {
    const method = getRequestMethod(input, init);
    const maxAttempts = isRetryableMethod(method) ? SUPABASE_READ_RETRIES + 1 : 1;
    let lastFailure: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchWithTimeout(baseFetch, input, init);
        if (
          attempt < maxAttempts &&
          isRetryableResponse(response.status)
        ) {
          await discardResponseBody(response);
          logRetry(input, method, attempt, maxAttempts, `HTTP ${response.status}`);
          await delay(SUPABASE_RETRY_DELAY_MS);
          continue;
        }

        return response;
      } catch (error) {
        lastFailure = error;
        if (attempt >= maxAttempts) {
          break;
        }

        logRetry(input, method, attempt, maxAttempts, describeFailure(error));
        await delay(SUPABASE_RETRY_DELAY_MS);
      }
    }

    throw new Error(
      `Supabase ${method} ${targetForLog(input)} failed after ${maxAttempts} attempt(s): ${describeFailure(lastFailure)}`,
    );
  };
}

async function fetchWithTimeout(
  baseFetch: FetchLike,
  input: Parameters<FetchLike>[0],
  init: Parameters<FetchLike>[1],
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    SUPABASE_FETCH_TIMEOUT_MS,
  );

  try {
    return await baseFetch(input, {
      ...init,
      signal: mergeSignals(init?.signal, timeoutController.signal),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function mergeSignals(
  requestSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!requestSignal) {
    return timeoutSignal;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  requestSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });

  if (requestSignal.aborted || timeoutSignal.aborted) {
    abort();
  }

  return controller.signal;
}

function getRequestMethod(
  input: Parameters<FetchLike>[0],
  init: Parameters<FetchLike>[1],
): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

function isRetryableMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function isRetryableResponse(status: number): boolean {
  return [408, 429, 500, 502, 503, 504, 520].includes(status);
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best effort: freeing the response body must not mask the real retry path.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeText = describeCause(cause);
  return causeText ? `${error.message} (${causeText})` : error.message;
}

function describeCause(cause: unknown): string {
  if (!cause || typeof cause !== 'object') {
    return '';
  }

  const parts = ['code', 'errno', 'syscall', 'hostname', 'message']
    .map((key) => {
      const value = (cause as Record<string, unknown>)[key];
      return value === undefined ? '' : `${key}=${String(value)}`;
    })
    .filter(Boolean);

  return parts.join(', ');
}

function targetForLog(input: Parameters<FetchLike>[0]): string {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

function logRetry(
  input: Parameters<FetchLike>[0],
  method: string,
  attempt: number,
  maxAttempts: number,
  reason: string,
): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  console.warn(
    `Supabase ${method} ${targetForLog(input)} failed on attempt ${attempt}/${maxAttempts}; retrying: ${reason}`,
  );
}

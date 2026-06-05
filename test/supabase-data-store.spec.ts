import { CommentRecord } from '../src/modules/comments/comment-record';
import { SupabaseDataStore } from '../src/adapters/data-store/supabase-data-store';

type CommentRow = {
  id: string;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
};

class FakeSupabaseTable {
  private pendingInsert?: Partial<CommentRow>;
  private pendingUpdate?: Partial<CommentRow>;
  private deleteMode = false;
  private selectedId?: string;

  constructor(private readonly rows: CommentRow[]) {}

  select() {
    return this;
  }

  order(column: keyof CommentRow, options: { ascending: boolean }) {
    const data = [...this.rows].sort((a, b) => {
      const direction = options.ascending ? 1 : -1;
      return a[column].localeCompare(b[column]) * direction;
    });
    return Promise.resolve({ data, error: null });
  }

  eq(column: keyof CommentRow, value: string) {
    if (column === 'id') {
      this.selectedId = value;
    }
    return this;
  }

  insert(input: Partial<CommentRow>) {
    this.pendingInsert = input;
    return this;
  }

  update(input: Partial<CommentRow>) {
    this.pendingUpdate = input;
    return this;
  }

  delete() {
    this.deleteMode = true;
    return this;
  }

  single() {
    if (!this.pendingInsert) {
      return Promise.resolve({ data: null, error: { message: 'No insert queued' } });
    }

    const now = '2026-06-06T00:00:00.000Z';
    const row = {
      id: `row-${this.rows.length + 1}`,
      author: this.pendingInsert.author || 'Anonymous',
      content: this.pendingInsert.content || '',
      created_at: now,
      updated_at: now,
    };
    this.rows.push(row);
    return Promise.resolve({ data: row, error: null });
  }

  maybeSingle() {
    const index = this.rows.findIndex((row) => row.id === this.selectedId);
    if (index === -1) {
      return Promise.resolve({ data: null, error: null });
    }

    if (this.pendingUpdate) {
      this.rows[index] = {
        ...this.rows[index],
        ...this.pendingUpdate,
        updated_at: '2026-06-06T00:01:00.000Z',
      };
      return Promise.resolve({ data: this.rows[index], error: null });
    }

    if (this.deleteMode) {
      const [deleted] = this.rows.splice(index, 1);
      return Promise.resolve({ data: { id: deleted.id }, error: null });
    }

    return Promise.resolve({ data: this.rows[index], error: null });
  }
}

function createStore(rows: CommentRow[]) {
  const client = {
    from: (table: string) => {
      expect(table).toBe('comments');
      return new FakeSupabaseTable(rows);
    },
  };

  return new SupabaseDataStore<CommentRecord>({
    table: 'comments',
    client,
    fromRow: (row) => ({
      id: String(row.id),
      author: String(row.author),
      content: String(row.content),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }),
    toRow: (input) => ({
      author: input.author,
      content: input.content,
    }),
  });
}

describe('SupabaseDataStore', () => {
  it('sets the server request secret header when creating a Supabase client', () => {
    const rows: CommentRow[] = [];
    let capturedHeaders: Record<string, string> | undefined;

    const store = new SupabaseDataStore<CommentRecord>({
      table: 'comments',
      url: 'https://example.supabase.co',
      apiKey: 'test-api-key',
      requestSecret: 'server-only-secret',
      clientFactory: (_url, _apiKey, options) => {
        capturedHeaders = options.global?.headers;
        return {
          from: () => new FakeSupabaseTable(rows),
        };
      },
      fromRow: (row) => ({
        id: String(row.id),
        author: String(row.author),
        content: String(row.content),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }),
      toRow: (input) => ({
        author: input.author,
        content: input.content,
      }),
    });

    expect(store).toBeInstanceOf(SupabaseDataStore);
    expect(capturedHeaders).toMatchObject({
      'x-api-secret': 'server-only-secret',
    });
  });

  it('maps Supabase rows into comment records and performs CRUD', async () => {
    const rows: CommentRow[] = [
      {
        id: 'row-1',
        author: 'Codex',
        content: 'Existing row',
        created_at: '2026-06-06T00:00:00.000Z',
        updated_at: '2026-06-06T00:00:00.000Z',
      },
    ];
    const store = createStore(rows);

    await expect(store.list()).resolves.toHaveLength(1);

    const created = await store.create({
      author: 'Acongm',
      content: 'Created through Supabase.',
    });
    expect(created).toMatchObject({
      id: 'row-2',
      author: 'Acongm',
      content: 'Created through Supabase.',
      createdAt: '2026-06-06T00:00:00.000Z',
    });

    await expect(store.get('row-2')).resolves.toMatchObject({
      id: 'row-2',
      author: 'Acongm',
    });

    await expect(store.update('row-2', { content: 'Updated.' })).resolves.toMatchObject({
      id: 'row-2',
      content: 'Updated.',
      updatedAt: '2026-06-06T00:01:00.000Z',
    });

    await expect(store.delete('row-2')).resolves.toBe(true);
    await expect(store.get('row-2')).resolves.toBeNull();
  });
});

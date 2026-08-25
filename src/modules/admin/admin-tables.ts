export type AdminTableSource = 'store' | 'supabase';

export type AdminTableKey =
  | 'comments'
  | 'chat_logs'
  | 'chat_client_labels'
  | 'auth_users'
  | 'chat_threads'
  | 'thread_messages'
  | 'profiles'
  | 'user_settings'
  | 'chats'
  | 'messages'
  | 'chat_runs';

export interface AdminTableMeta {
  key: AdminTableKey;
  title: string;
  source: AdminTableSource;
  description: string;
  idField: string;
  orderBy: string;
}

export const ADMIN_TABLES: AdminTableMeta[] = [
  {
    key: 'comments',
    title: 'Comments',
    source: 'store',
    description: 'Public comments adapter (memory / file / Supabase).',
    idField: 'id',
    orderBy: 'createdAt',
  },
  {
    key: 'chat_logs',
    title: 'Chat logs',
    source: 'store',
    description: 'Recorded AI chat requests and responses.',
    idField: 'id',
    orderBy: 'createdAt',
  },
  {
    key: 'chat_client_labels',
    title: 'Client labels',
    source: 'store',
    description: 'Admin labels for anonymous chat client IDs.',
    idField: 'id',
    orderBy: 'createdAt',
  },
  {
    key: 'auth_users',
    title: 'Local auth users',
    source: 'store',
    description: 'Seeded local accounts. Password hashes are redacted.',
    idField: 'id',
    orderBy: 'createdAt',
  },
  {
    key: 'chat_threads',
    title: 'Legacy chat threads',
    source: 'store',
    description: 'Pre-v2 chat threads (chat_threads table).',
    idField: 'id',
    orderBy: 'createdAt',
  },
  {
    key: 'thread_messages',
    title: 'Legacy thread messages',
    source: 'store',
    description: 'Messages belonging to legacy chat threads.',
    idField: 'id',
    orderBy: 'createdAt',
  },
  {
    key: 'profiles',
    title: 'User profiles',
    source: 'supabase',
    description: 'Supabase profiles linked to auth.users.',
    idField: 'id',
    orderBy: 'updated_at',
  },
  {
    key: 'user_settings',
    title: 'User settings',
    source: 'supabase',
    description: 'Per-user language / theme / model / prompt.',
    idField: 'user_id',
    orderBy: 'updated_at',
  },
  {
    key: 'chats',
    title: 'Chats v2',
    source: 'supabase',
    description: 'Current chat sessions.',
    idField: 'id',
    orderBy: 'updated_at',
  },
  {
    key: 'messages',
    title: 'Chat messages v2',
    source: 'supabase',
    description: 'Current chat messages (parts JSON).',
    idField: 'id',
    orderBy: 'created_at',
  },
  {
    key: 'chat_runs',
    title: 'Chat runs',
    source: 'supabase',
    description: 'Assistant generation runs and status.',
    idField: 'id',
    orderBy: 'updated_at',
  },
];

export function findAdminTable(key: string): AdminTableMeta | undefined {
  return ADMIN_TABLES.find((table) => table.key === key);
}

export type AdminTableDefinition = {
  key: string;
  table: string;
  label: string;
  description: string;
};

export const ADMIN_TABLE_DEFINITIONS: AdminTableDefinition[] = [
  {
    key: 'comments',
    table: 'comments',
    label: 'Comments',
    description: 'Demo CRUD comments table.',
  },
  {
    key: 'chat_logs',
    table: 'chat_logs',
    label: 'Chat Logs',
    description: 'Structured AI chat request/response logs.',
  },
  {
    key: 'auth_users',
    table: 'auth_users',
    label: 'Auth Users',
    description: 'Legacy local auth user records.',
  },
  {
    key: 'chat_client_labels',
    table: 'chat_client_labels',
    label: 'Client Labels',
    description: 'Friendly labels for chat client identifiers.',
  },
  {
    key: 'user_settings',
    table: 'user_settings',
    description: 'Per-user UI and model preferences.',
    label: 'User Settings',
  },
  {
    key: 'chat_threads',
    table: 'chat_threads',
    label: 'Chat Threads',
    description: 'Platform v2 chat thread metadata.',
  },
  {
    key: 'chat_messages',
    table: 'chat_messages',
    label: 'Chat Messages',
    description: 'Platform v2 chat messages.',
  },
];

export function resolveAdminTable(key: string): AdminTableDefinition | undefined {
  const normalized = key.trim().toLowerCase();
  return ADMIN_TABLE_DEFINITIONS.find(
    (item) => item.key === normalized || item.table === normalized,
  );
}

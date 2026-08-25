export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type FieldType = 'text' | 'password' | 'textarea' | 'json' | 'file';

export interface EndpointField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  initialValue?: string;
}

export interface EndpointAction {
  id: string;
  label: string;
  method: HttpMethod;
  path: string;
  danger?: boolean;
  /** Build the request from form values. */
  build?: (values: Record<string, string>) => {
    path?: string;
    body?: unknown;
    headers?: Record<string, string>;
    formData?: boolean;
  };
}

export interface EndpointGroup {
  key: string;
  title: string;
  description: string;
  paths: string[];
  fields: EndpointField[];
  actions: EndpointAction[];
}

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    key: 'health',
    title: 'Health',
    description: '查看运行时配置（dataMode、aiProvider 等）。',
    paths: ['/api/health'],
    fields: [],
    actions: [{ id: 'health', label: 'GET /api/health', method: 'GET', path: '/api/health' }],
  },
  {
    key: 'ai-chat',
    title: 'AI Chat',
    description: '项目内简单对话接口。',
    paths: ['/api/ai/chat'],
    fields: [
      {
        name: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        initialValue: 'hello',
      },
    ],
    actions: [
      {
        id: 'ai-chat',
        label: 'POST /api/ai/chat',
        method: 'POST',
        path: '/api/ai/chat',
        build: (values) => ({ body: { prompt: values.prompt } }),
      },
    ],
  },
  {
    key: 'openai',
    title: 'OpenAI Compatible',
    description: 'OpenAI 风格 chat completions，可用服务端 AI_MODEL。',
    paths: ['/v1/chat/completions', '/api/openai/v1/chat/completions'],
    fields: [
      {
        name: 'model',
        label: 'Model',
        type: 'text',
        placeholder: 'deepseek-v4-flash',
      },
      {
        name: 'messages',
        label: 'Messages（JSON）',
        type: 'json',
        initialValue: '[{"role":"user","content":"Hello"}]',
      },
    ],
    actions: [
      {
        id: 'openai',
        label: 'POST /v1/chat/completions',
        method: 'POST',
        path: '/v1/chat/completions',
        build: (values) => ({
          body: {
            ...(values.model ? { model: values.model } : {}),
            messages: JSON.parse(values.messages || '[]'),
          },
        }),
      },
      {
        id: 'openai-alias',
        label: 'POST /api/openai/v1/chat/completions',
        method: 'POST',
        path: '/api/openai/v1/chat/completions',
        build: (values) => ({
          body: {
            ...(values.model ? { model: values.model } : {}),
            messages: JSON.parse(values.messages || '[]'),
          },
        }),
      },
    ],
  },
  {
    key: 'comments',
    title: 'Comments CRUD',
    description: '生产环境需 DATA_MODE=supabase。',
    paths: ['/api/comments', '/api/comments/:id'],
    fields: [
      { name: 'author', label: 'Author', type: 'text', initialValue: 'API Demo' },
      {
        name: 'content',
        label: 'Content',
        type: 'textarea',
        initialValue: 'Supabase CRUD test comment.',
      },
      { name: 'id', label: 'Comment ID', type: 'text', placeholder: 'uuid' },
      {
        name: 'updateContent',
        label: 'Update Content',
        type: 'textarea',
        initialValue: 'Updated through API admin.',
      },
    ],
    actions: [
      { id: 'list', label: 'GET 列表', method: 'GET', path: '/api/comments' },
      {
        id: 'create',
        label: 'POST 创建',
        method: 'POST',
        path: '/api/comments',
        build: (values) => ({
          body: { author: values.author, content: values.content },
        }),
      },
      {
        id: 'get',
        label: 'GET :id',
        method: 'GET',
        path: '/api/comments/:id',
        build: (values) => ({ path: `/api/comments/${values.id}` }),
      },
      {
        id: 'update',
        label: 'PATCH :id',
        method: 'PATCH',
        path: '/api/comments/:id',
        build: (values) => ({
          path: `/api/comments/${values.id}`,
          body: { content: values.updateContent },
        }),
      },
      {
        id: 'delete',
        label: 'DELETE :id',
        method: 'DELETE',
        path: '/api/comments/:id',
        danger: true,
        build: (values) => ({ path: `/api/comments/${values.id}` }),
      },
    ],
  },
  {
    key: 'auth',
    title: 'Auth',
    description: '本地账号、管理员会话、以及 .acongm.com cookie session。',
    paths: [
      '/api/auth',
      '/api/auth/session',
      '/api/auth/userinfo',
      '/api/auth/mode',
      '/api/auth/me',
    ],
    fields: [
      {
        name: 'username',
        label: 'Username / Email',
        type: 'text',
        initialValue: 'demo',
      },
      { name: 'password', label: 'Password', type: 'password', initialValue: 'demo' },
      {
        name: 'token',
        label: 'Access Token',
        type: 'text',
        placeholder: 'Bearer access token',
      },
    ],
    actions: [
      {
        id: 'public-config',
        label: 'GET public-config',
        method: 'GET',
        path: '/api/auth/public-config',
      },
      { id: 'mode', label: 'GET mode', method: 'GET', path: '/api/auth/mode' },
      {
        id: 'login',
        label: 'POST login',
        method: 'POST',
        path: '/api/auth/login',
        build: (values) => ({
          body: { username: values.username, password: values.password },
        }),
      },
      { id: 'me', label: 'GET me', method: 'GET', path: '/api/auth/me' },
      { id: 'session', label: 'GET session', method: 'GET', path: '/api/auth/session' },
      {
        id: 'userinfo',
        label: 'GET userinfo',
        method: 'GET',
        path: '/api/auth/userinfo',
      },
    ],
  },
  {
    key: 'user',
    title: 'User Center',
    description: '需要 Supabase access_token 或共享 cookie。',
    paths: [
      '/api/user/info',
      '/api/user/profile',
      '/api/user/settings',
    ],
    fields: [
      {
        name: 'displayName',
        label: 'displayName',
        type: 'text',
        placeholder: 'Acongm',
      },
      {
        name: 'theme',
        label: 'theme',
        type: 'text',
        initialValue: 'system',
      },
      {
        name: 'defaultModel',
        label: 'defaultModel',
        type: 'text',
        placeholder: 'deepseek-v4-flash',
      },
      {
        name: 'defaultPrompt',
        label: 'defaultPrompt',
        type: 'text',
        placeholder: 'Be concise.',
      },
    ],
    actions: [
      { id: 'info', label: 'GET info', method: 'GET', path: '/api/user/info' },
      { id: 'me', label: 'GET me', method: 'GET', path: '/api/user/me' },
      { id: 'profile', label: 'GET profile', method: 'GET', path: '/api/user/profile' },
      {
        id: 'patch-profile',
        label: 'PATCH profile',
        method: 'PATCH',
        path: '/api/user/profile',
        build: (values) => ({ body: { displayName: values.displayName } }),
      },
      {
        id: 'settings',
        label: 'GET settings',
        method: 'GET',
        path: '/api/user/settings',
      },
      {
        id: 'patch-settings',
        label: 'PATCH settings',
        method: 'PATCH',
        path: '/api/user/settings',
        build: (values) => ({
          body: {
            theme: values.theme,
            defaultModel: values.defaultModel,
            defaultPrompt: values.defaultPrompt,
          },
        }),
      },
    ],
  },
  {
    key: 'chats',
    title: 'Chats v2',
    description: '列表不带全文；详情默认 tail-first。',
    paths: ['/api/chats', '/api/chats/:id/messages/stream'],
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        initialValue: 'API console chat',
      },
      { name: 'id', label: 'Chat ID', type: 'text', placeholder: 'uuid' },
      { name: 'before', label: 'before cursor', type: 'text' },
      {
        name: 'content',
        label: 'Message',
        type: 'textarea',
        initialValue: 'hello from api admin',
      },
    ],
    actions: [
      { id: 'list', label: 'GET list', method: 'GET', path: '/api/chats' },
      {
        id: 'create',
        label: 'POST create',
        method: 'POST',
        path: '/api/chats',
        build: (values) => ({ body: { title: values.title } }),
      },
      {
        id: 'get',
        label: 'GET :id desc',
        method: 'GET',
        path: '/api/chats/:id',
        build: (values) => ({ path: `/api/chats/${values.id}?order=desc` }),
      },
      {
        id: 'messages',
        label: 'GET messages',
        method: 'GET',
        path: '/api/chats/:id/messages',
        build: (values) => ({
          path: values.before
            ? `/api/chats/${values.id}/messages?before=${encodeURIComponent(values.before)}`
            : `/api/chats/${values.id}/messages`,
        }),
      },
      {
        id: 'stream',
        label: 'POST stream',
        method: 'POST',
        path: '/api/chats/:id/messages/stream',
        build: (values) => ({
          path: `/api/chats/${values.id}/messages/stream`,
          body: { content: values.content },
        }),
      },
    ],
  },
  {
    key: 'oauth',
    title: 'OAuth',
    description: '未配置时回退 auth.acongm.com。',
    paths: ['/api/auth/oauth/providers'],
    fields: [],
    actions: [
      {
        id: 'providers',
        label: 'GET providers',
        method: 'GET',
        path: '/api/auth/oauth/providers',
      },
    ],
  },
  {
    key: 'site-config',
    title: 'Site Config',
    description: '读取 site.config 域名与限额。',
    paths: ['/api/config/site'],
    fields: [],
    actions: [
      {
        id: 'site',
        label: 'GET /api/config/site',
        method: 'GET',
        path: '/api/config/site',
      },
    ],
  },
  {
    key: 'upload',
    title: 'Upload',
    description: 'Vercel 上 FILE_MODE=memory 为临时存储。',
    paths: ['/api/upload'],
    fields: [
      { name: 'file', label: 'File', type: 'file' },
      { name: 'key', label: 'Upload Key', type: 'text' },
    ],
    actions: [
      {
        id: 'post',
        label: 'POST upload',
        method: 'POST',
        path: '/api/upload',
        build: () => ({ formData: true }),
      },
      {
        id: 'get',
        label: 'GET :key',
        method: 'GET',
        path: '/api/upload/:key',
        build: (values) => ({ path: `/api/upload/${values.key}` }),
      },
    ],
  },
  {
    key: 'proxy',
    title: 'Proxy',
    description: '需配置 PROXY_ALLOWLIST。',
    paths: ['/api/proxy'],
    fields: [
      { name: 'provider', label: 'Provider', type: 'text', placeholder: 'github' },
      {
        name: 'body',
        label: 'Request Body（JSON）',
        type: 'json',
        initialValue: '{"path":"/","method":"GET"}',
      },
    ],
    actions: [
      {
        id: 'proxy',
        label: 'POST /api/proxy/:provider',
        method: 'POST',
        path: '/api/proxy/:provider',
        build: (values) => ({
          path: `/api/proxy/${values.provider}`,
          body: JSON.parse(values.body || '{}'),
        }),
      },
    ],
  },
];

export function findEndpointGroup(key: string): EndpointGroup | undefined {
  return ENDPOINT_GROUPS.find((group) => group.key === key);
}

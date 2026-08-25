import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('umi admin console catalog', () => {
  const endpoints = readFileSync(
    join(process.cwd(), 'admin/src/constants/endpoints.ts'),
    'utf8',
  );
  const app = readFileSync(join(process.cwd(), 'admin/src/app.tsx'), 'utf8');
  const login = readFileSync(
    join(process.cwd(), 'admin/src/pages/user/Login.tsx'),
    'utf8',
  );

  it('covers every previous debug-console endpoint group', () => {
    const groups = [
      '/api/health',
      '/api/ai/chat',
      '/v1/chat/completions',
      '/api/comments',
      '/api/auth',
      '/api/auth/session',
      '/api/auth/userinfo',
      '/api/user/info',
      '/api/user/profile',
      '/api/chats',
      '/api/chats/:id/messages/stream',
      '/api/auth/oauth/providers',
      '/api/config/site',
      '/api/upload',
      '/api/proxy',
    ];
    for (const group of groups) {
      expect(endpoints).toContain(group);
    }
    expect(endpoints).toContain('deepseek-v4-flash');
    expect(endpoints).not.toContain('deepseek-v4-pro');
    expect(endpoints).not.toContain('gpt-4.1-mini');
  });

  it('intercepts unauthenticated users and sends them to auth.acongm.com', () => {
    expect(app).toContain('/user/login');
    expect(app).toContain('/403');
    expect(login).toContain('auth.acongm.com');
    expect(login).toContain('o.arvin.peng@gmail.com');
    expect(login).toContain('acongm@126.com');
  });
});

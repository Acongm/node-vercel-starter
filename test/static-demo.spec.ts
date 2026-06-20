import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('API debug console assets', () => {
  it('includes all endpoint groups in index.html', () => {
    const html = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    const groups = [
      '/api/health',
      '/api/ai/chat',
      '/v1/chat/completions',
      '/api/comments',
      '/api/auth',
      '/api/upload',
      '/api/proxy',
    ];
    for (const group of groups) {
      expect(html).toContain(group);
    }
  });

  it('loads api-demo.js script', () => {
    const html = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    expect(html).toContain('./api-demo.js');
    expect(html).toContain('./chat-logs.html');
    expect(html).not.toContain('type="module"');
  });

  it('includes chat logs viewer assets', () => {
    const html = readFileSync(join(process.cwd(), 'public/chat-logs.html'), 'utf8');
    const script = readFileSync(join(process.cwd(), 'public/chat-logs.js'), 'utf8');

    expect(html).toContain('/api/auth/login');
    expect(html).toContain('./chat-logs.js');
    expect(html).toContain('datetime-local');
    expect(html).toContain('client-labels');
    expect(html).not.toContain('filter-call-source');
    expect(html).not.toContain('filter-limit');
    expect(script).toContain('chat_logs_access_token');
    expect(script).toContain('buildPageUrl');
    expect(script).toContain('/api/ai/chat/client-labels');
    expect(script).not.toMatch(/^\s*export\s/m);
  });

  it('ships browser-safe api-demo.js without module exports', () => {
    const script = readFileSync(join(process.cwd(), 'public/api-demo.js'), 'utf8');
    expect(script).toContain('function boot()');
    expect(script).not.toMatch(/^\s*export\s/m);
    expect(script).not.toContain('exports.');
  });
});

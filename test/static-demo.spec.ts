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

  it('loads api-demo.js module', () => {
    const html = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    expect(html).toContain('./api-demo.js');
  });
});

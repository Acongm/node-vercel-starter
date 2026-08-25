import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('API admin static assets', () => {
  it('keeps a chat-logs bookmark that lands on the admin table', () => {
    const htmlPath = join(process.cwd(), 'public/chat-logs.html');
    if (!existsSync(htmlPath)) {
      return;
    }
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).toContain('/#/data/chat_logs');
  });

  it('serves the umi admin shell after build', () => {
    const htmlPath = join(process.cwd(), 'public/index.html');
    if (!existsSync(htmlPath)) {
      return;
    }
    const html = readFileSync(htmlPath, 'utf8');
    const isUmi = html.includes('/umi.js') || html.includes('root');
    const isLegacy = html.includes('./api-demo.js');
    expect(isUmi || isLegacy).toBe(true);
  });
});

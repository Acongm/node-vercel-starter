import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('vercel routing', () => {
  const vercel = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8');
  const config = JSON.parse(vercel) as {
    routes: Array<{ src: string; dest?: string; status?: number }>;
  };

  it('routes API before frontend', () => {
    const apiIndex = config.routes.findIndex((route) =>
      route.src.startsWith('/api/'),
    );
    const feIndex = config.routes.findIndex((route) => route.src.startsWith('/fe'));
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(feIndex).toBeGreaterThan(apiIndex);
  });

  it('serves the admin SPA under /fe', () => {
    expect(vercel).toContain('"/fe/(.*)"');
    expect(vercel).toContain('"/fe/index.html"');
    expect(vercel).toContain('"Location": "/fe"');
  });
});

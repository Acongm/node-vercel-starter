import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readIcoOpaqueRgb(path: string): [number, number, number] | null {
  const data = readFileSync(path);
  const size = data.readUInt32LE(14);
  const imageOff = data.readUInt32LE(18);
  const headerSize = data.readUInt32LE(imageOff);
  const xorOff = imageOff + headerSize;
  for (let i = xorOff; i < xorOff + size; i += 4) {
    const a = data[i + 3];
    if (a > 200) return [data[i + 2], data[i + 1], data[i]];
  }
  return null;
}

describe('API admin favicon', () => {
  const root = process.cwd();
  const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
  const legacyIndex = readFileSync(
    join(root, 'static/legacy/index.html'),
    'utf8',
  );
  const legacyLogs = readFileSync(
    join(root, 'static/legacy/chat-logs.html'),
    'utf8',
  );

  it('routes favicon assets from /fe', () => {
    expect(vercel).toContain('"/favicon.ico"');
    expect(vercel).toContain('"/fe/favicon.ico"');
    expect(vercel).toContain('"/icon.png"');
    expect(vercel).toContain('"/fe/icon.png"');
  });

  it('keeps purple portal icon assets in admin/public', () => {
    expect(readIcoOpaqueRgb(join(root, 'admin/public/favicon.ico'))).toEqual([
      168, 85, 247,
    ]);
    expect(legacyIndex).toContain('href="/icon.png"');
    expect(legacyIndex).toContain('href="/favicon.ico"');
    expect(legacyLogs).toContain('href="/icon.png"');
    expect(legacyLogs).toContain('href="/favicon.ico"');
  });
});

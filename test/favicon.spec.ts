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

describe('API debug console favicon', () => {
  const root = process.cwd();
  const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
  const index = readFileSync(join(root, 'public/index.html'), 'utf8');
  const logs = readFileSync(join(root, 'public/chat-logs.html'), 'utf8');

  it('keeps an explicit Vercel route for /favicon.ico and /icon.png', () => {
    expect(vercel).toContain('"/favicon.ico"');
    expect(vercel).toContain('"/public/favicon.ico"');
    expect(vercel).toContain('"/icon.png"');
    expect(vercel).toContain('"/public/icon.png"');
  });

  it('serves a purple portal 聪 icon and links png + ico from HTML pages', () => {
    expect(readIcoOpaqueRgb(join(root, 'public/favicon.ico'))).toEqual([
      168, 85, 247,
    ]);
    expect(index).toContain('href="/icon.png"');
    expect(index).toContain('href="/favicon.ico"');
    expect(logs).toContain('href="/icon.png"');
    expect(logs).toContain('href="/favicon.ico"');
  });
});

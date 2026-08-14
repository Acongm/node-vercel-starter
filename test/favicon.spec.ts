import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readOpaqueRgb(path: string): [number, number, number] | null {
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
  it('serves a purple portal 聪 icon and links it from HTML pages', () => {
    const icon = join(process.cwd(), 'public/favicon.ico');
    const index = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    const logs = readFileSync(
      join(process.cwd(), 'public/chat-logs.html'),
      'utf8',
    );

    expect(readOpaqueRgb(icon)).toEqual([168, 85, 247]);
    expect(index).toContain('href="/favicon.ico"');
    expect(logs).toContain('href="/favicon.ico"');
  });
});

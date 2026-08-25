import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const publicDir = join(root, 'public');
const legacySourceDir = join(root, 'static', 'legacy');
const legacyDir = join(publicDir, 'legacy');
const adminDir = join(root, 'admin');

const legacyFiles = [
  'index.html',
  'api-demo.js',
  'api-demo.css',
  'client-db.js',
  'chat-logs.html',
  'chat-logs.js',
];

function copyLegacyAssets() {
  mkdirSync(legacyDir, { recursive: true });
  for (const file of legacyFiles) {
    const source = join(legacySourceDir, file);
    const target = join(legacyDir, file);
    if (existsSync(source)) {
      cpSync(source, target);
    }
  }
}

function clearGeneratedPublic() {
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
    return;
  }

  for (const entry of readdirSync(publicDir)) {
    rmSync(join(publicDir, entry), { recursive: true, force: true });
  }
}

clearGeneratedPublic();

const install = spawnSync('npm', ['install'], {
  cwd: adminDir,
  stdio: 'inherit',
});

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const build = spawnSync('npm', ['run', 'build'], {
  cwd: adminDir,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

copyLegacyAssets();

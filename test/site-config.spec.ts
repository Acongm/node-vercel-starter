import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_SITE_CONFIG,
  getApiBase,
  getChatLimitPerDay,
  getPublishBranch,
  loadSiteConfig,
} from '../src/config/site-config';

describe('site-config', () => {
  const dir = join(tmpdir(), `site-config-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'site.config.yaml'),
      `
domains:
  api: https://api.example.test
git:
  owner: Acongm
  repo: portal
  contentDir: content/docs
  defaultBranch: master
  publishBranch: master
limits:
  anon:
    chatPerDay: 15
  user:
    chatPerDay: 100
`,
      'utf8',
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads yaml and exposes helpers', () => {
    const config = loadSiteConfig({}, dir);
    expect(config.domains.api).toBe('https://api.example.test');
    expect(getPublishBranch(config)).toBe('master');
    expect(getApiBase(config)).toBe('https://api.example.test');
    expect(getChatLimitPerDay(config, 'anon')).toBe(15);
  });

  it('allows env to override publishBranch and limits', () => {
    const config = loadSiteConfig(
      {
        SITE_GIT_PUBLISH_BRANCH: 'dev',
        SITE_LIMIT_ANON_CHAT_PER_DAY: '30',
      },
      dir,
    );

    expect(getPublishBranch(config)).toBe('dev');
    expect(config.limits.anon.chatPerDay).toBe(30);
    expect(config.git.defaultBranch).toBe('master');
  });

  it('falls back to defaults when file is missing', () => {
    const config = loadSiteConfig(
      { SITE_CONFIG_PATH: 'missing-site.config.yaml' },
      dir,
    );
    expect(config.domains).toEqual(DEFAULT_SITE_CONFIG.domains);
  });
});

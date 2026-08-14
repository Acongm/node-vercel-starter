import { AuthService } from '../src/modules/auth/auth.service';
import {
  AppConfig,
  isBrowserSafeSupabaseKey,
  loadAppConfig,
} from '../src/config/app-config';
import {
  ACONGM_SUPABASE_ANON_KEY,
  ACONGM_SUPABASE_URL,
} from '../src/config/acongm-supabase-public';

function anonJwt() {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'),
    'sig',
  ].join('.');
}

function serviceRoleJwt() {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(JSON.stringify({ role: 'service_role' })).toString(
      'base64url',
    ),
    'sig',
  ].join('.');
}

describe('AuthService.publicConfig', () => {
  function createService(supabase: Partial<AppConfig['supabase']> = {}) {
    const config = {
      supabase: {
        url: undefined,
        publicKey: undefined,
        apiKey: 'service-role-must-never-leak',
        ...supabase,
      },
      auth: {
        mode: 'jwt',
        jwtSecret: 'test',
        sessionTtl: '1h',
        oauth: {},
      },
    } as AppConfig;
    return new AuthService(config, {} as never, {} as never, {} as never);
  }

  it('returns browser-safe supabase url and anon key when configured', () => {
    const service = createService({
      url: 'https://example.supabase.co',
      publicKey: 'sb_publishable_test',
    });

    expect(service.publicConfig()).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'sb_publishable_test',
      configured: true,
    });
  });

  it('never includes the service role key', () => {
    const payload = JSON.stringify(
      createService({
        url: 'https://example.supabase.co',
        publicKey: 'anon-key',
      }).publicConfig(),
    );

    expect(payload).not.toContain('service-role-must-never-leak');
  });

  it('reports unconfigured when public keys are missing', () => {
    expect(createService().publicConfig()).toEqual({
      supabaseUrl: null,
      supabaseAnonKey: null,
      configured: false,
    });
  });
});

describe('isBrowserSafeSupabaseKey', () => {
  it('accepts publishable and anon JWT keys', () => {
    expect(isBrowserSafeSupabaseKey('sb_publishable_abc')).toBe(true);
    expect(isBrowserSafeSupabaseKey(anonJwt())).toBe(true);
  });

  it('rejects service-role and secret keys', () => {
    expect(isBrowserSafeSupabaseKey('sb_secret_abc')).toBe(false);
    expect(isBrowserSafeSupabaseKey(serviceRoleJwt())).toBe(false);
  });
});

describe('loadAppConfig public supabase key', () => {
  it('promotes a browser-safe SUPABASE_API_KEY to publicKey', () => {
    const key = anonJwt();
    const config = loadAppConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_API_KEY: key,
    });
    expect(config.supabase.publicKey).toBe(key);
  });

  it('does not expose a service_role SUPABASE_API_KEY as publicKey', () => {
    const config = loadAppConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_API_KEY: serviceRoleJwt(),
    });
    expect(config.supabase.publicKey).toBeUndefined();
  });

  it('falls back to the known acongm public anon key when only the project URL is set', () => {
    const config = loadAppConfig({
      SUPABASE_URL: ACONGM_SUPABASE_URL,
    });
    expect(config.supabase.publicKey).toBe(ACONGM_SUPABASE_ANON_KEY);

    const service = new AuthService(
      config,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(service.publicConfig()).toEqual({
      supabaseUrl: ACONGM_SUPABASE_URL,
      supabaseAnonKey: ACONGM_SUPABASE_ANON_KEY,
      configured: true,
    });
  });
});

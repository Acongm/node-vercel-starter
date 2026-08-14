import { AuthService } from '../src/modules/auth/auth.service';
import { AppConfig } from '../src/config/app-config';

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

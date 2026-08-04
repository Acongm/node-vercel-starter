import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, SITE_CONFIG } from '../common/tokens';
import { loadAppConfig } from './app-config';
import { loadSiteConfig } from './site-config';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: loadAppConfig,
    },
    {
      provide: SITE_CONFIG,
      useFactory: loadSiteConfig,
    },
  ],
  exports: [APP_CONFIG, SITE_CONFIG],
})
export class AppConfigModule {}

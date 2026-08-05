import { Controller, Get, Inject } from '@nestjs/common';
import { SITE_CONFIG } from '../../common/tokens';
import {
  SiteConfig,
  getApiBase,
  getPublishBranch,
} from '../../config/site-config';

@Controller('api/config')
export class SiteConfigController {
  constructor(@Inject(SITE_CONFIG) private readonly siteConfig: SiteConfig) {}

  /** Public site config slice used by clients (domains / publish branch / limits). */
  @Get('site')
  getSiteConfig() {
    return {
      domains: this.siteConfig.domains,
      git: {
        owner: this.siteConfig.git.owner,
        repo: this.siteConfig.git.repo,
        contentDir: this.siteConfig.git.contentDir,
        defaultBranch: this.siteConfig.git.defaultBranch,
        publishBranch: getPublishBranch(this.siteConfig),
      },
      limits: this.siteConfig.limits,
      apiBase: getApiBase(this.siteConfig),
    };
  }
}

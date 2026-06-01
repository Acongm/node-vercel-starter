import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';

@Injectable()
export class HealthService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  getHealth() {
    return {
      ok: true,
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      runtimeTarget: this.config.runtimeTarget,
      dataMode: this.config.dataMode,
      fileMode: this.config.fileMode,
      authMode: this.config.auth.mode,
      aiProvider: this.config.ai.provider,
      timestamp: new Date().toISOString(),
    };
  }
}

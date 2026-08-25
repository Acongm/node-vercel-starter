import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminInsightsModule } from '../admin-insights/admin-insights.module';
import { PlatformConfigAdminController } from './platform-config-admin.controller';
import { PlatformRuntimeConfigService } from './platform-runtime-config.service';

@Global()
@Module({
  imports: [AuthModule, AdminInsightsModule],
  controllers: [PlatformConfigAdminController],
  providers: [PlatformRuntimeConfigService],
  exports: [PlatformRuntimeConfigService],
})
export class PlatformConfigModule {}

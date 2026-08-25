import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import type { PlatformRuntimeConfigPatch } from './platform-runtime-config.types';
import { PlatformRuntimeConfigService } from './platform-runtime-config.service';

@Controller('api/admin/platform-config')
@UseGuards(AdminAccessGuard)
export class PlatformConfigAdminController {
  constructor(private readonly platformConfig: PlatformRuntimeConfigService) {}

  @Get()
  getConfig() {
    return this.platformConfig.getAdminView();
  }

  @Put()
  updateConfig(@Body() body: PlatformRuntimeConfigPatch) {
    return this.platformConfig.updateAdminPatch(body);
  }
}

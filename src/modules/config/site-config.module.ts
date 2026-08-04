import { Module } from '@nestjs/common';
import { SiteConfigController } from './site-config.controller';

@Module({
  controllers: [SiteConfigController],
})
export class SiteConfigModule {}

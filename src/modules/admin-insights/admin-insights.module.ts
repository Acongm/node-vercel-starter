import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { ChatAdminController } from './chat-admin.controller';
import { ChatAdminService } from './chat-admin.service';
import { KbAdminController } from './kb-admin.controller';
import { KbAdminService } from './kb-admin.service';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { RequestLogsController } from './request-logs.controller';
import { RequestLogsService } from './request-logs.service';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { UserIdentityService } from './user-identity.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

@Module({
  imports: [AuthModule, DiscoveryModule],
  controllers: [
    RoutesController,
    ChatAdminController,
    KbAdminController,
    UsersAdminController,
    RequestLogsController,
    OverviewController,
  ],
  providers: [
    SupabaseAdminClientService,
    UserIdentityService,
    RoutesService,
    ChatAdminService,
    KbAdminService,
    UsersAdminService,
    RequestLogsService,
    OverviewService,
  ],
  exports: [SupabaseAdminClientService],
})
export class AdminInsightsModule {}

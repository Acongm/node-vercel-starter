import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { KbAdminService } from './kb-admin.service';
import {
  KbUsageQueryDto,
  ListKbAnalysisDto,
  ListKbChunksDto,
  ListKbFailuresDto,
  ListKbJobsDto,
} from './dto/kb-admin.dto';

@Controller('api/admin/kb')
@UseGuards(AdminAccessGuard)
export class KbAdminController {
  constructor(private readonly kbAdmin: KbAdminService) {}

  @Get('jobs')
  listJobs(@Query() query: ListKbJobsDto) {
    return this.kbAdmin.listJobs(query);
  }

  @Get('failures')
  listFailures(@Query() query: ListKbFailuresDto) {
    return this.kbAdmin.listFailures(query);
  }

  @Get('analysis')
  listAnalysis(@Query() query: ListKbAnalysisDto) {
    return this.kbAdmin.listAnalysis(query);
  }

  @Get('chunks')
  listChunks(@Query() query: ListKbChunksDto) {
    return this.kbAdmin.listChunks(query);
  }

  @Get('usage')
  getUsage(@Query() query: KbUsageQueryDto) {
    return this.kbAdmin.getUsage(query);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { RequestLogsService } from './request-logs.service';
import { ListRequestLogsDto } from './dto/request-logs.dto';
import { RequestLogStatsDto } from './dto/request-logs-stats.dto';

@Controller('api/admin/request-logs')
@UseGuards(AdminAccessGuard)
export class RequestLogsController {
  constructor(private readonly requestLogs: RequestLogsService) {}

  @Get('stats')
  getStats(@Query() query: RequestLogStatsDto) {
    return this.requestLogs.getStats(query);
  }

  @Get()
  listLogs(@Query() query: ListRequestLogsDto) {
    return this.requestLogs.listLogs(query);
  }
}

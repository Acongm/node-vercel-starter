import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { OverviewService } from './overview.service';

@Controller('api/admin/overview')
@UseGuards(AdminAccessGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  getOverview() {
    return this.overview.getOverview();
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { RoutesService } from './routes.service';

@Controller('api/admin')
@UseGuards(AdminAccessGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('routes')
  listRoutes() {
    return {
      items: this.routesService.listRoutes(),
    };
  }
}

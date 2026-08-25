import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequireRoles } from '../auth/roles.decorator';
import { AuthenticatedRequest, RolesGuard } from '../auth/roles.guard';
import { AdminCatalogService } from './admin-catalog.service';
import { ListAdminTableDto } from './dto/list-admin-table.dto';

@Controller('api/admin')
@UseGuards(RolesGuard)
@RequireRoles('admin')
export class AdminController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return {
      ...this.authService.principalResponse(request.auth!),
      tables: this.catalog.listTables(),
    };
  }

  @Get('tables')
  tables() {
    return { tables: this.catalog.listTables() };
  }

  @Get('tables/:table')
  list(@Param('table') table: string, @Query() query: ListAdminTableDto) {
    return this.catalog.listRows(table, query);
  }

  @Get('tables/:table/:id')
  get(@Param('table') table: string, @Param('id') id: string) {
    return this.catalog.getRow(table, id);
  }
}

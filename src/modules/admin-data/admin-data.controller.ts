import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { AdminDataService } from './admin-data.service';
import { ListAdminTableDto } from './dto/list-admin-table.dto';

@Controller('api/admin')
@UseGuards(AdminAccessGuard)
export class AdminDataController {
  constructor(private readonly adminData: AdminDataService) {}

  @Get('tables')
  listTables() {
    return {
      items: this.adminData.listTables(),
    };
  }

  @Get('tables/:tableKey')
  listRows(
    @Param('tableKey') tableKey: string,
    @Query() query: ListAdminTableDto,
  ) {
    return this.adminData.listRows(tableKey, query);
  }

  @Get('tables/:tableKey/:id')
  getRow(@Param('tableKey') tableKey: string, @Param('id') id: string) {
    return this.adminData.getRow(tableKey, id);
  }
}

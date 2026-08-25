import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { UsersAdminService } from './users-admin.service';
import { ListLocalUsersDto, ListPlatformUsersDto } from './dto/users-admin.dto';

@Controller('api/admin/users')
@UseGuards(AdminAccessGuard)
export class UsersAdminController {
  constructor(private readonly usersAdmin: UsersAdminService) {}

  @Get()
  listPlatformUsers(@Query() query: ListPlatformUsersDto) {
    return this.usersAdmin.listPlatformUsers(query);
  }

  @Get('local')
  listLocalUsers(@Query() query: ListLocalUsersDto) {
    return this.usersAdmin.listLocalUsers(query);
  }
}

import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard, SupabaseAuthenticatedRequest } from '../auth/supabase-auth.guard';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserService } from './user.service';

@Controller('api/user')
@UseGuards(SupabaseAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  me(@Req() request: SupabaseAuthenticatedRequest) {
    return this.userService.me(request, request.auth!);
  }

  @Patch('profile')
  updateProfile(
    @Req() request: SupabaseAuthenticatedRequest,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateProfile(request, request.auth!, dto);
  }
}

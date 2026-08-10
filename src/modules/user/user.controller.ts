import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard, SupabaseAuthenticatedRequest } from '../auth/supabase-auth.guard';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UserService } from './user.service';

@Controller('api/user')
@UseGuards(SupabaseAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Canonical account snapshot (identity + profile + settings).
   * Preferred for Auth/Chat/Portal login-state UI.
   */
  @Get('me')
  me(@Req() request: SupabaseAuthenticatedRequest) {
    return this.userService.me(request, request.auth!);
  }

  /**
   * Explicit getUserInfo alias — same payload as GET /me.
   * Use when clients want a clearly named "user info for display" call.
   */
  @Get('info')
  getUserInfo(@Req() request: SupabaseAuthenticatedRequest) {
    return this.userService.getUserInfo(request, request.auth!);
  }

  @Get('settings')
  getSettings(@Req() request: SupabaseAuthenticatedRequest) {
    return this.userService.getSettings(request, request.auth!);
  }

  @Patch('settings')
  updateSettings(
    @Req() request: SupabaseAuthenticatedRequest,
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.userService.updateSettings(request, request.auth!, dto);
  }

  @Patch('profile')
  updateProfile(
    @Req() request: SupabaseAuthenticatedRequest,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateProfile(request, request.auth!, dto);
  }
}

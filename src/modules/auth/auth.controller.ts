import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequireRoles } from './roles.decorator';
import {
  AuthenticatedRequest,
  OptionalAuthGuard,
  RolesGuard,
} from './roles.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('mode')
  mode() {
    return this.authService.mode();
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Public principal probe: anonymous tier when no/invalid token is absent. */
  @Get('me')
  @UseGuards(OptionalAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.principalResponse(request.auth!);
  }

  /**
   * Example protected probe for dochub write ACL (editor+).
   * Real dochub routes will reuse RequireRoles + RolesGuard in P3.
   */
  @Get('roles/editor-check')
  @UseGuards(RolesGuard)
  @RequireRoles('editor')
  editorCheck(@Req() request: AuthenticatedRequest) {
    return {
      ok: true,
      role: request.auth?.role,
      tier: request.auth?.tier,
    };
  }

  @Get('roles/admin-check')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  adminCheck(@Req() request: AuthenticatedRequest) {
    return {
      ok: true,
      role: request.auth?.role,
      tier: request.auth?.tier,
    };
  }
}

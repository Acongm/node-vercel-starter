import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { extractAccessToken } from './bearer-token';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequireRoles } from './roles.decorator';
import {
  AuthenticatedRequest,
  OptionalAuthGuard,
  RolesGuard,
} from './roles.guard';
import { SupabaseAuthGuard, SupabaseAuthenticatedRequest } from './supabase-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('mode')
  mode() {
    return this.authService.mode();
  }

  @Get('public-config')
  publicConfig() {
    return this.authService.publicConfig();
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
   * Keycloak-like session: cookie on .acongm.com or Bearer.
   * Email and OAuth logins both surface the same user / userInfo.
   */
  @Get('session')
  @UseGuards(OptionalAuthGuard)
  session(@Req() request: AuthenticatedRequest) {
    return this.authService.sessionResponse(
      request.auth!,
      extractAccessToken(request),
    );
  }

  /** OIDC-style userinfo. 401 when the shared session cookie / Bearer is missing. */
  @Get('userinfo')
  @UseGuards(SupabaseAuthGuard)
  userinfo(@Req() request: SupabaseAuthenticatedRequest) {
    return this.authService.userInfoResponse(request.auth!);
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

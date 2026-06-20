import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminSessionGuard, extractBearerToken } from './admin-session.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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

  @Get('me')
  @UseGuards(AdminSessionGuard)
  me(@Req() request: Request) {
    const token = extractBearerToken(request);
    if (!token) {
      return { authenticated: false };
    }
    return this.authService.me(token);
  }
}

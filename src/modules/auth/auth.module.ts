import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminSessionService } from './admin-session.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthService } from './jwt-auth.service';
import { OptionalAuthGuard, RolesGuard } from './roles.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminSessionService,
    AdminSessionGuard,
    JwtAuthService,
    RolesGuard,
    OptionalAuthGuard,
  ],
  exports: [
    AdminSessionService,
    AdminSessionGuard,
    JwtAuthService,
    RolesGuard,
    OptionalAuthGuard,
  ],
})
export class AuthModule {}

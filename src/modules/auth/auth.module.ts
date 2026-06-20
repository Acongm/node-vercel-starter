import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminSessionService } from './admin-session.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AdminSessionService, AdminSessionGuard],
  exports: [AdminSessionService, AdminSessionGuard],
})
export class AuthModule {}

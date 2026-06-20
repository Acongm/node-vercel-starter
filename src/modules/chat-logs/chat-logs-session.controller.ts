import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ChatLogsSessionGuard } from './chat-logs-session.guard';
import { ChatLogsSessionService } from './chat-logs-session.service';
import { ChatLogsLoginDto } from './dto/chat-logs-login.dto';

function extractBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim() || undefined;
}

@Controller('api/ai/chat/logs/session')
export class ChatLogsSessionController {
  constructor(private readonly sessionService: ChatLogsSessionService) {}

  @Post('login')
  login(@Body() dto: ChatLogsLoginDto) {
    return this.sessionService.login(dto);
  }

  @Get('me')
  @UseGuards(ChatLogsSessionGuard)
  async me(@Req() request: Request) {
    const token = extractBearerToken(request);
    if (!token) {
      return { authenticated: false };
    }

    const payload = await this.sessionService.verifyToken(token);
    return {
      authenticated: true,
      user: {
        username: payload.sub,
        role: payload.role,
      },
    };
  }
}

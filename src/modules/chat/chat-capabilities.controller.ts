import { Controller, Get } from '@nestjs/common';
import { CHAT_V2_CAPABILITIES } from './chat.capabilities';

@Controller('api/chat')
export class ChatCapabilitiesController {
  @Get('capabilities')
  getCapabilities() {
    return { capabilities: CHAT_V2_CAPABILITIES };
  }
}

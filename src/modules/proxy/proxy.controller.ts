import { Body, Controller, Param, Post } from '@nestjs/common';
import { ProxyRequestDto } from './dto/proxy-request.dto';
import { ProxyService } from './proxy.service';

@Controller('api/proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post(':provider')
  forward(@Param('provider') provider: string, @Body() dto: ProxyRequestDto) {
    return this.proxyService.forward(provider, dto);
  }
}

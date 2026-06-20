import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminSessionGuard } from '../auth/admin-session.guard';
import { ClientLabelsService } from './client-labels.service';
import { CreateClientLabelDto } from './dto/create-client-label.dto';
import { UpdateClientLabelDto } from './dto/update-client-label.dto';

@Controller('api/ai/chat/client-labels')
@UseGuards(AdminSessionGuard)
export class ClientLabelsController {
  constructor(private readonly clientLabelsService: ClientLabelsService) {}

  @Get()
  list() {
    return this.clientLabelsService.list();
  }

  @Post()
  create(@Body() dto: CreateClientLabelDto) {
    return this.clientLabelsService.create(dto);
  }

  @Get(':clientId')
  get(@Param('clientId') clientId: string) {
    return this.clientLabelsService.getByClientId(clientId);
  }

  @Patch(':clientId')
  update(
    @Param('clientId') clientId: string,
    @Body() dto: UpdateClientLabelDto,
  ) {
    return this.clientLabelsService.updateByClientId(clientId, dto);
  }

  @Delete(':clientId')
  @HttpCode(204)
  async delete(@Param('clientId') clientId: string) {
    await this.clientLabelsService.deleteByClientId(clientId);
  }
}

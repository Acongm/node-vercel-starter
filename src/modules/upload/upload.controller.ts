import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile as UploadedFileDecorator,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService } from './upload.service';
import { UploadedFile } from './uploaded-file';

@Controller('api/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFileDecorator() file?: UploadedFile) {
    if (!file) {
      throw new BadRequestException('Upload a file with multipart field name "file".');
    }
    return this.uploadService.store(file);
  }

  @Get(':key')
  async get(@Param('key') key: string, @Res() res: Response) {
    const file = await this.uploadService.get(key);
    if (!file) {
      throw new BadRequestException('File not found.');
    }
    res.setHeader('content-type', file.contentType);
    res.end(file.buffer);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('api/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list() {
    return this.commentsService.list();
  }

  @Post()
  create(@Body() dto: CreateCommentDto) {
    return this.commentsService.create(dto);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const comment = await this.commentsService.get(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    const comment = await this.commentsService.update(id, dto);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    const deleted = await this.commentsService.delete(id);
    if (!deleted) {
      throw new NotFoundException('Comment not found');
    }
  }
}

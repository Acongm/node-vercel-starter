import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_STORE } from '../../common/tokens';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import { CommentRecord } from './comment-record';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENT_STORE)
    private readonly comments: DataStore<CommentRecord>,
  ) {}

  list(): Promise<CommentRecord[]> {
    return this.comments.list();
  }

  create(dto: CreateCommentDto): Promise<CommentRecord> {
    return this.comments.create({
      author: dto.author || 'Anonymous',
      content: dto.content,
    });
  }

  get(id: string): Promise<CommentRecord | null> {
    return this.comments.get(id);
  }

  update(id: string, dto: UpdateCommentDto): Promise<CommentRecord | null> {
    return this.comments.update(id, dto);
  }

  delete(id: string): Promise<boolean> {
    return this.comments.delete(id);
  }
}

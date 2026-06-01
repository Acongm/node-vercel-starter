import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { APP_CONFIG, COMMENT_STORE } from '../../common/tokens';
import { MemoryDataStore } from '../../adapters/data-store/memory-data-store';
import { FileDataStore } from '../../adapters/data-store/file-data-store';
import { UnsupportedDataStore } from '../../adapters/data-store/unsupported-data-store';
import { CommentRecord } from './comment-record';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController],
  providers: [
    CommentsService,
    {
      provide: COMMENT_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        switch (config.dataMode) {
          case 'none':
          case 'memory':
            return new MemoryDataStore<CommentRecord>();
          case 'file':
            return new FileDataStore<CommentRecord>(config.dataFilePath);
          default:
            return new UnsupportedDataStore<CommentRecord>(config.dataMode);
        }
      },
    },
  ],
})
export class CommentsModule {}

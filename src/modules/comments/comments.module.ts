import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { APP_CONFIG, COMMENT_STORE } from '../../common/tokens';
import { MemoryDataStore } from '../../adapters/data-store/memory-data-store';
import { FileDataStore } from '../../adapters/data-store/file-data-store';
import { UnsupportedDataStore } from '../../adapters/data-store/unsupported-data-store';
import {
  SupabaseDataStore,
  SupabaseRow,
} from '../../adapters/data-store/supabase-data-store';
import { CreateEntityInput } from '../../adapters/data-store/data-store.interface';
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
          case 'supabase':
            if (!config.supabase.url || !config.supabase.apiKey) {
              throw new Error(
                'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
              );
            }

            return new SupabaseDataStore<CommentRecord>({
              table: config.supabase.commentsTable,
              url: config.supabase.url,
              apiKey: config.supabase.apiKey,
              requestSecret: config.supabase.requestSecret,
              fromRow: commentFromSupabaseRow,
              toRow: commentToSupabaseRow,
            });
          default:
            return new UnsupportedDataStore<CommentRecord>(config.dataMode);
        }
      },
    },
  ],
})
export class CommentsModule {}

function commentFromSupabaseRow(row: SupabaseRow): CommentRecord {
  return {
    id: String(row.id),
    author: String(row.author),
    content: String(row.content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function commentToSupabaseRow(
  input: Partial<CreateEntityInput<CommentRecord>>,
): SupabaseRow {
  return {
    author: input.author,
    content: input.content,
  };
}

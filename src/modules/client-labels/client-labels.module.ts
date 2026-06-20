import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { APP_CONFIG, CLIENT_LABEL_STORE } from '../../common/tokens';
import { MemoryDataStore } from '../../adapters/data-store/memory-data-store';
import { FileDataStore } from '../../adapters/data-store/file-data-store';
import { UnsupportedDataStore } from '../../adapters/data-store/unsupported-data-store';
import {
  SupabaseDataStore,
  SupabaseRow,
} from '../../adapters/data-store/supabase-data-store';
import { CreateEntityInput } from '../../adapters/data-store/data-store.interface';
import { AuthModule } from '../auth/auth.module';
import { ClientLabelRecord } from './client-label-record';
import { ClientLabelsController } from './client-labels.controller';
import { ClientLabelsService } from './client-labels.service';

@Module({
  imports: [AuthModule],
  controllers: [ClientLabelsController],
  providers: [
    ClientLabelsService,
    {
      provide: CLIENT_LABEL_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        switch (config.dataMode) {
          case 'none':
          case 'memory':
            return new MemoryDataStore<ClientLabelRecord>();
          case 'file':
            return new FileDataStore<ClientLabelRecord>(
              config.clientLabelsFilePath,
            );
          case 'supabase':
            if (!config.supabase.url || !config.supabase.apiKey) {
              throw new Error(
                'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
              );
            }

            return new SupabaseDataStore<ClientLabelRecord>({
              table: config.supabase.chatClientLabelsTable,
              url: config.supabase.url,
              apiKey: config.supabase.apiKey,
              requestSecret: config.supabase.requestSecret,
              fromRow: clientLabelFromSupabaseRow,
              toRow: clientLabelToSupabaseRow,
            });
          default:
            return new UnsupportedDataStore<ClientLabelRecord>(config.dataMode);
        }
      },
    },
  ],
  exports: [ClientLabelsService],
})
export class ClientLabelsModule {}

function clientLabelFromSupabaseRow(row: SupabaseRow): ClientLabelRecord {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    label: String(row.label),
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function clientLabelToSupabaseRow(
  input: Partial<CreateEntityInput<ClientLabelRecord>>,
): SupabaseRow {
  return {
    client_id: input.clientId,
    label: input.label,
    note: input.note,
  };
}

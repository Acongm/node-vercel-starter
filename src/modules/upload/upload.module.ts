import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { APP_CONFIG, FILE_STORE } from '../../common/tokens';
import { MemoryFileStore } from '../../adapters/file-store/memory-file-store';
import { LocalFileStore } from '../../adapters/file-store/local-file-store';
import { UnsupportedFileStore } from '../../adapters/file-store/unsupported-file-store';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    {
      provide: FILE_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        switch (config.fileMode) {
          case 'memory':
            return new MemoryFileStore();
          case 'local':
            return new LocalFileStore(config.uploadDir);
          default:
            return new UnsupportedFileStore(config.fileMode);
        }
      },
    },
  ],
})
export class UploadModule {}

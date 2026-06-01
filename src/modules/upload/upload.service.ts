import { Inject, Injectable } from '@nestjs/common';
import { FILE_STORE } from '../../common/tokens';
import { FileStore } from '../../adapters/file-store/file-store.interface';
import { UploadedFile } from './uploaded-file';

@Injectable()
export class UploadService {
  constructor(@Inject(FILE_STORE) private readonly fileStore: FileStore) {}

  store(file: UploadedFile) {
    return this.fileStore.put({
      filename: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });
  }

  get(key: string) {
    return this.fileStore.get(key);
  }
}

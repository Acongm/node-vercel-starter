import { randomUUID } from 'node:crypto';
import { FileStore, FileStorePutInput, StoredFile } from './file-store.interface';

interface MemoryFileRecord extends StoredFile {
  buffer: Buffer;
}

export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, MemoryFileRecord>();

  async put(input: FileStorePutInput): Promise<StoredFile> {
    const key = randomUUID();
    const record: MemoryFileRecord = {
      key,
      filename: input.filename,
      contentType: input.contentType,
      size: input.buffer.byteLength,
      buffer: input.buffer,
    };
    this.files.set(key, record);
    const { buffer: _buffer, ...stored } = record;
    return stored;
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const record = this.files.get(key);
    if (!record) {
      return null;
    }
    return { buffer: record.buffer, contentType: record.contentType };
  }

  async delete(key: string): Promise<boolean> {
    return this.files.delete(key);
  }
}

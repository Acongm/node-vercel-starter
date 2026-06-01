import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStore, FileStorePutInput, StoredFile } from './file-store.interface';

export class LocalFileStore implements FileStore {
  private readonly metadata = new Map<string, StoredFile>();

  constructor(private readonly uploadDir: string) {}

  async put(input: FileStorePutInput): Promise<StoredFile> {
    await mkdir(this.uploadDir, { recursive: true });
    const key = randomUUID();
    const stored: StoredFile = {
      key,
      filename: input.filename,
      contentType: input.contentType,
      size: input.buffer.byteLength,
      url: `/api/upload/${key}`,
    };
    await writeFile(this.pathFor(key), input.buffer);
    this.metadata.set(key, stored);
    return stored;
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const metadata = this.metadata.get(key);
    if (!metadata) {
      return null;
    }
    const buffer = await readFile(this.pathFor(key));
    return { buffer, contentType: metadata.contentType };
  }

  async delete(key: string): Promise<boolean> {
    const metadata = this.metadata.get(key);
    if (!metadata) {
      return false;
    }
    await rm(this.pathFor(key), { force: true });
    this.metadata.delete(key);
    return true;
  }

  private pathFor(key: string): string {
    return join(this.uploadDir, key);
  }
}

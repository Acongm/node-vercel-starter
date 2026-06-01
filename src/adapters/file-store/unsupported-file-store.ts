import { FileStore, FileStorePutInput, StoredFile } from './file-store.interface';

export class UnsupportedFileStore implements FileStore {
  constructor(private readonly mode: string) {}

  async put(_input: FileStorePutInput): Promise<StoredFile> {
    throw this.error();
  }

  async get(): Promise<{ buffer: Buffer; contentType: string } | null> {
    throw this.error();
  }

  async delete(): Promise<boolean> {
    throw this.error();
  }

  private error(): Error {
    return new Error(
      `FILE_MODE=${this.mode} needs a concrete adapter. Add it behind FileStore before using uploads.`,
    );
  }
}

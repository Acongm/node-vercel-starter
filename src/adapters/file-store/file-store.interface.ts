export interface StoredFile {
  key: string;
  url?: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface FileStorePutInput {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export interface FileStore {
  put(input: FileStorePutInput): Promise<StoredFile>;
  get(key: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  delete(key: string): Promise<boolean>;
}

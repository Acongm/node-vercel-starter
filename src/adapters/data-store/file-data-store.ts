import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  CreateEntityInput,
  DataStore,
  EntityRecord,
} from './data-store.interface';

export class FileDataStore<T extends EntityRecord> implements DataStore<T> {
  constructor(private readonly filePath: string) {}

  async list(): Promise<T[]> {
    const records = await this.readAll();
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<T | null> {
    const records = await this.readAll();
    return records.find((record) => record.id === id) ?? null;
  }

  async create(input: CreateEntityInput<T>): Promise<T> {
    const records = await this.readAll();
    const now = new Date().toISOString();
    const record = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;
    records.push(record);
    await this.writeAll(records);
    return record;
  }

  async update(id: string, patch: Partial<CreateEntityInput<T>>): Promise<T | null> {
    const records = await this.readAll();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) {
      return null;
    }

    const next = {
      ...records[index],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    } as T;
    records[index] = next;
    await this.writeAll(records);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    const records = await this.readAll();
    const next = records.filter((record) => record.id !== id);
    if (next.length === records.length) {
      return false;
    }
    await this.writeAll(next);
    return true;
  }

  private async readAll(): Promise<T[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeAll(records: T[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2));
  }
}

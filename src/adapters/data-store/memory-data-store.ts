import { randomUUID } from 'node:crypto';
import {
  CreateEntityInput,
  DataStore,
  EntityRecord,
} from './data-store.interface';

export class MemoryDataStore<T extends EntityRecord> implements DataStore<T> {
  private readonly records = new Map<string, T>();

  async list(): Promise<T[]> {
    return Array.from(this.records.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async get(id: string): Promise<T | null> {
    return this.records.get(id) ?? null;
  }

  async create(input: CreateEntityInput<T>): Promise<T> {
    const now = new Date().toISOString();
    const record = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;
    this.records.set(record.id, record);
    return record;
  }

  async update(id: string, patch: Partial<CreateEntityInput<T>>): Promise<T | null> {
    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    } as T;
    this.records.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

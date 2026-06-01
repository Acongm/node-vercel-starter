import {
  CreateEntityInput,
  DataStore,
  EntityRecord,
} from './data-store.interface';

export class UnsupportedDataStore<T extends EntityRecord> implements DataStore<T> {
  constructor(private readonly mode: string) {}

  async list(): Promise<T[]> {
    throw this.error();
  }

  async get(): Promise<T | null> {
    throw this.error();
  }

  async create(_input: CreateEntityInput<T>): Promise<T> {
    throw this.error();
  }

  async update(): Promise<T | null> {
    throw this.error();
  }

  async delete(): Promise<boolean> {
    throw this.error();
  }

  private error(): Error {
    return new Error(
      `DATA_MODE=${this.mode} needs a concrete adapter. Add it behind DataStore before using this endpoint.`,
    );
  }
}

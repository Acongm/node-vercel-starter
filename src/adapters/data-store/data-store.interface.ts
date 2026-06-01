export interface EntityRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateEntityInput<T extends EntityRecord> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface DataStore<T extends EntityRecord> {
  list(query?: Record<string, unknown>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: CreateEntityInput<T>): Promise<T>;
  update(id: string, patch: Partial<CreateEntityInput<T>>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientLabelRecord } from '../src/modules/client-labels/client-label-record';
import { ClientLabelsService } from '../src/modules/client-labels/client-labels.service';
import { DataStore } from '../src/adapters/data-store/data-store.interface';

function createStore(initial: ClientLabelRecord[] = []) {
  const records = new Map(initial.map((record) => [record.id, record]));

  const store: DataStore<ClientLabelRecord> = {
    list: async () =>
      Array.from(records.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    get: async (id) => records.get(id) ?? null,
    create: async (input) => {
      const now = new Date().toISOString();
      const record = {
        ...input,
        id: `label-${records.size + 1}`,
        createdAt: now,
        updatedAt: now,
      } as ClientLabelRecord;
      records.set(record.id, record);
      return record;
    },
    update: async (id, patch) => {
      const current = records.get(id);
      if (!current) return null;
      const next = {
        ...current,
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      } as ClientLabelRecord;
      records.set(id, next);
      return next;
    },
    delete: async (id) => records.delete(id),
  };

  return store;
}

describe('ClientLabelsService', () => {
  it('creates and maps labels by clientId', async () => {
    const service = new ClientLabelsService(createStore());
    await service.create({
      clientId: 'client-a',
      label: '测试 A',
      note: 'note-a',
    });

    const map = await service.mapByClientIds(['client-a', 'client-b']);
    expect(map.get('client-a')).toEqual({
      label: '测试 A',
      note: 'note-a',
    });
    expect(map.has('client-b')).toBe(false);
  });

  it('rejects duplicate clientId on create', async () => {
    const service = new ClientLabelsService(
      createStore([
        {
          id: '1',
          clientId: 'client-a',
          label: '已有',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    await expect(
      service.create({ clientId: 'client-a', label: '重复' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates and deletes by clientId', async () => {
    const service = new ClientLabelsService(
      createStore([
        {
          id: '1',
          clientId: 'client-a',
          label: '旧标记',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    const updated = await service.updateByClientId('client-a', {
      label: '新标记',
    });
    expect(updated.label).toBe('新标记');

    await service.deleteByClientId('client-a');
    await expect(service.getByClientId('client-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

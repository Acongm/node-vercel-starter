import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CLIENT_LABEL_STORE } from '../../common/tokens';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import {
  ClientLabelRecord,
  ClientLabelView,
} from './client-label-record';
import { CreateClientLabelDto } from './dto/create-client-label.dto';
import { UpdateClientLabelDto } from './dto/update-client-label.dto';

@Injectable()
export class ClientLabelsService {
  constructor(
    @Inject(CLIENT_LABEL_STORE)
    private readonly clientLabels: DataStore<ClientLabelRecord>,
  ) {}

  list(): Promise<ClientLabelRecord[]> {
    return this.clientLabels.list();
  }

  async create(dto: CreateClientLabelDto): Promise<ClientLabelRecord> {
    const existing = await this.findRecordByClientId(dto.clientId);
    if (existing) {
      throw new ConflictException(
        `Client label already exists for clientId "${dto.clientId}".`,
      );
    }

    return this.clientLabels.create({
      clientId: dto.clientId,
      label: dto.label,
      note: dto.note,
    });
  }

  async getByClientId(clientId: string): Promise<ClientLabelRecord> {
    const record = await this.findRecordByClientId(clientId);
    if (!record) {
      throw new NotFoundException(
        `Client label not found for clientId "${clientId}".`,
      );
    }
    return record;
  }

  async updateByClientId(
    clientId: string,
    dto: UpdateClientLabelDto,
  ): Promise<ClientLabelRecord> {
    const record = await this.findRecordByClientId(clientId);
    if (!record) {
      throw new NotFoundException(
        `Client label not found for clientId "${clientId}".`,
      );
    }

    const patch: Partial<Pick<ClientLabelRecord, 'label' | 'note'>> = {};
    if (dto.label !== undefined) {
      patch.label = dto.label;
    }
    if (dto.note !== undefined) {
      patch.note = dto.note;
    }

    const updated = await this.clientLabels.update(record.id, patch);
    if (!updated) {
      throw new NotFoundException(
        `Client label not found for clientId "${clientId}".`,
      );
    }
    return updated;
  }

  async deleteByClientId(clientId: string): Promise<void> {
    const record = await this.findRecordByClientId(clientId);
    if (!record) {
      throw new NotFoundException(
        `Client label not found for clientId "${clientId}".`,
      );
    }

    const deleted = await this.clientLabels.delete(record.id);
    if (!deleted) {
      throw new NotFoundException(
        `Client label not found for clientId "${clientId}".`,
      );
    }
  }

  async mapByClientIds(
    clientIds: string[],
  ): Promise<Map<string, ClientLabelView>> {
    const uniqueIds = [...new Set(clientIds.filter(Boolean))];
    if (!uniqueIds.length) {
      return new Map();
    }

    const all = await this.clientLabels.list();
    const idSet = new Set(uniqueIds);
    const map = new Map<string, ClientLabelView>();

    for (const record of all) {
      if (!idSet.has(record.clientId)) {
        continue;
      }
      map.set(record.clientId, {
        label: record.label,
        note: record.note,
      });
    }

    return map;
  }

  private async findRecordByClientId(
    clientId: string,
  ): Promise<ClientLabelRecord | null> {
    const all = await this.clientLabels.list();
    return all.find((record) => record.clientId === clientId) ?? null;
  }
}

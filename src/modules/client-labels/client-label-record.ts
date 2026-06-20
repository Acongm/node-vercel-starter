import { EntityRecord } from '../../adapters/data-store/data-store.interface';

export interface ClientLabelRecord extends EntityRecord {
  clientId: string;
  label: string;
  note?: string;
}

export interface ClientLabelView {
  label: string;
  note?: string;
}

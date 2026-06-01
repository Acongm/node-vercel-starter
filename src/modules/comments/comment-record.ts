import { EntityRecord } from '../../adapters/data-store/data-store.interface';

export interface CommentRecord extends EntityRecord {
  author: string;
  content: string;
}

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { EntityRecord } from '../../adapters/data-store/data-store.interface';
import { PlatformRole } from './roles';

const scrypt = promisify(scryptCb);

export type AuthProvider = 'local' | 'github' | 'google';

export interface AuthUserRecord extends EntityRecord {
  email: string;
  username?: string;
  /** scrypt hash; null for OAuth-only accounts */
  passwordHash?: string;
  provider: AuthProvider;
  providerUserId?: string;
  role: Exclude<PlatformRole, 'anonymous'>;
  name?: string;
  avatarUrl?: string;
  disabled: boolean;
}

export type CreateAuthUserInput = Omit<
  AuthUserRecord,
  'id' | 'createdAt' | 'updatedAt'
>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string | undefined,
): Promise<boolean> {
  if (!passwordHash?.startsWith('scrypt$')) return false;
  const [, salt, hashHex] = passwordHash.split('$');
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashOAuthState(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

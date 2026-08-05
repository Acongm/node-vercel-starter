import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import { AUTH_USER_STORE } from '../../common/tokens';
import { PlatformRole } from './roles';
import {
  AuthProvider,
  AuthUserRecord,
  CreateAuthUserInput,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from './auth-user-record';

@Injectable()
export class AuthUsersService {
  constructor(
    @Inject(AUTH_USER_STORE)
    private readonly users: DataStore<AuthUserRecord>,
  ) {}

  async list(): Promise<AuthUserRecord[]> {
    return this.users.list();
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const normalized = normalizeEmail(email);
    const all = await this.users.list();
    return all.find((user) => user.email === normalized) ?? null;
  }

  async findByUsername(username: string): Promise<AuthUserRecord | null> {
    const key = username.trim().toLowerCase();
    const all = await this.users.list();
    return (
      all.find((user) => user.username?.toLowerCase() === key) ?? null
    );
  }

  async findByProvider(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthUserRecord | null> {
    const all = await this.users.list();
    return (
      all.find(
        (user) =>
          user.provider === provider && user.providerUserId === providerUserId,
      ) ?? null
    );
  }

  async get(id: string): Promise<AuthUserRecord> {
    const user = await this.users.get(id);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async createLocalUser(input: {
    email: string;
    password: string;
    username?: string;
    role?: Exclude<PlatformRole, 'anonymous'>;
    name?: string;
  }): Promise<AuthUserRecord> {
    const email = normalizeEmail(input.email);
    if (await this.findByEmail(email)) {
      throw new ConflictException(`User already exists: ${email}`);
    }
    if (input.username && (await this.findByUsername(input.username))) {
      throw new ConflictException(`Username already exists: ${input.username}`);
    }

    const record: CreateAuthUserInput = {
      email,
      username: input.username?.trim() || undefined,
      passwordHash: await hashPassword(input.password),
      provider: 'local',
      role: input.role || 'viewer',
      name: input.name || input.username || email,
      disabled: false,
    };
    return this.users.create(record);
  }

  async upsertOAuthUser(input: {
    provider: 'github' | 'google';
    providerUserId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    role?: Exclude<PlatformRole, 'anonymous'>;
  }): Promise<AuthUserRecord> {
    const email = normalizeEmail(input.email);
    const existingByProvider = await this.findByProvider(
      input.provider,
      input.providerUserId,
    );
    if (existingByProvider) {
      return (
        (await this.users.update(existingByProvider.id, {
          email,
          name: input.name || existingByProvider.name,
          avatarUrl: input.avatarUrl || existingByProvider.avatarUrl,
        })) || existingByProvider
      );
    }

    const existingByEmail = await this.findByEmail(email);
    if (existingByEmail) {
      // Link OAuth identity onto existing local account.
      return (
        (await this.users.update(existingByEmail.id, {
          provider: input.provider,
          providerUserId: input.providerUserId,
          name: input.name || existingByEmail.name,
          avatarUrl: input.avatarUrl || existingByEmail.avatarUrl,
        })) || existingByEmail
      );
    }

    return this.users.create({
      email,
      provider: input.provider,
      providerUserId: input.providerUserId,
      role: input.role || 'viewer',
      name: input.name || email,
      avatarUrl: input.avatarUrl,
      disabled: false,
    });
  }

  async authenticateLocal(
    identifier: string,
    password: string,
  ): Promise<AuthUserRecord | null> {
    const byEmail = identifier.includes('@')
      ? await this.findByEmail(identifier)
      : null;
    const user =
      byEmail ||
      (await this.findByUsername(identifier)) ||
      (await this.findByEmail(identifier));
    if (!user || user.disabled || user.provider !== 'local') return null;
    if (!(await verifyPassword(password, user.passwordHash))) return null;
    return user;
  }
}

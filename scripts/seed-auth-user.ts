/**
 * Manually seed a local auth user (registration is closed).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-auth-user.ts \
 *     --email you@acongm.com --password 'secret' --role viewer
 *
 * Optional: --username alice --name "Alice" --data-mode memory|file|supabase
 *
 * Env mirrors the API (DATA_MODE, AUTH_USERS_FILE_PATH, SUPABASE_*).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthUsersService } from '../src/modules/auth/auth-users.service';
import { PlatformRole } from '../src/modules/auth/roles';

type Args = {
  email?: string;
  password?: string;
  username?: string;
  name?: string;
  role: Exclude<PlatformRole, 'anonymous'>;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { role: 'viewer' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--') || value === undefined) continue;
    i += 1;
    switch (key) {
      case '--email':
        out.email = value;
        break;
      case '--password':
        out.password = value;
        break;
      case '--username':
        out.username = value;
        break;
      case '--name':
        out.name = value;
        break;
      case '--role':
        if (value === 'viewer' || value === 'editor' || value === 'admin') {
          out.role = value;
        } else {
          throw new Error(`Invalid --role: ${value}`);
        }
        break;
      case '--data-mode':
        process.env.DATA_MODE = value;
        break;
      default:
        break;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email || !args.password) {
    console.error(
      'Required: --email <email> --password <password> [--username] [--name] [--role viewer|editor|admin]',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const users = app.get(AuthUsersService);
    const created = await users.createLocalUser({
      email: args.email,
      password: args.password,
      username: args.username,
      name: args.name,
      role: args.role,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          id: created.id,
          email: created.email,
          username: created.username,
          role: created.role,
          provider: created.provider,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Apply api_request_logs migrations to the live Acongm Supabase project
 * and reload the PostgREST schema cache.
 *
 * Requires ACONGM_SUPABASE_ACCESS_TOKEN (or SUPABASE_ACCESS_TOKEN).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_REF, request } from './lib/ephemeral-supabase-user.mjs';

const TOKEN = (
  process.env.ACONGM_SUPABASE_ACCESS_TOKEN ||
  process.env.SUPABASE_ACCESS_TOKEN ||
  ''
).trim();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = [
  '20260825090000_api_request_logs.sql',
  '20260825120000_api_request_logs_caller.sql',
];

async function runSql(query) {
  const result = await request(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: { query },
    },
  );
  if (result.status >= 300) {
    throw new Error(`SQL failed (${result.status}): ${result.text.slice(0, 400)}`);
  }
  return result.json;
}

function quote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  if (!TOKEN) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: 'ACONGM_SUPABASE_ACCESS_TOKEN is not set',
      }),
    );
    process.exit(2);
  }

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(ROOT, 'supabase/migrations', file), 'utf8');
    await runSql(sql);
    const version = file.replace(/_.*$/, '');
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
    await runSql(`
      insert into supabase_migrations.schema_migrations (version, name)
      select ${quote(version)}, ${quote(name)}
      where not exists (
        select 1 from supabase_migrations.schema_migrations
        where version = ${quote(version)}
      )
    `);
    console.log(JSON.stringify({ applied: file, version, name }));
  }

  await runSql("notify pgrst, 'reload schema'");
  const columns = await runSql(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'api_request_logs'
    order by ordinal_position
  `);
  const names = Array.isArray(columns)
    ? columns.map((row) => row.column_name)
    : [];
  if (!names.includes('call_source') || !names.includes('caller_kind')) {
    throw new Error(`caller columns missing: ${names.join(',')}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      table: 'api_request_logs',
      columns: names,
      schemaReloaded: true,
    }),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }));
  process.exit(1);
});

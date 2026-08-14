import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const mutants = [
  {
    name: 'branch order must be root-to-head',
    file: 'src/modules/chat/chat.types.ts',
    search: 'return branch.reverse();',
    replacement: 'return branch;',
    test: 'test/chat.branch.spec.ts',
  },
  {
    name: 'chat cursor tie-breaker must remain descending',
    file: 'src/modules/chat/chat.repository.ts',
    search: 'id.lt.${after.id})',
    replacement: 'id.gt.${after.id})',
    test: 'test/chat.pagination.spec.ts',
  },
  {
    name: 'unknown stream errors must stay sanitized',
    file: 'src/modules/chat/chat.errors.ts',
    search: "code: 'CHAT_STREAM_FAILED',",
    replacement: "code: 'RAW_PROVIDER_ERROR',",
    test: 'test/chat.errors.spec.ts',
  },
  {
    name: 'existing durable run must replay instead of invoking provider',
    file: 'src/modules/chat/chat.service.ts',
    search: 'if (!runCreated) {',
    replacement: 'if (false && !runCreated) {',
    test: 'test/chat.service.runs.edge.spec.ts',
  },
  {
    name: 'missing bearer must stay AUTH_REQUIRED',
    file: 'src/modules/auth/supabase-auth.guard.ts',
    search: "code: 'AUTH_REQUIRED',",
    replacement: "code: 'UNAUTHORIZED',",
    test: 'test/supabase-auth.guard.spec.ts',
  },
  {
    name: 'User Center must reject non-Supabase principals',
    file: 'src/modules/user/user.service.ts',
    search: "code: 'SUPABASE_AUTH_REQUIRED',",
    replacement: "code: 'AUTH_OPTIONAL',",
    test: 'test/user.contract.spec.ts',
  },
  {
    name: 'unsupported resume must stay capability=false',
    file: 'src/modules/chat/chat.capabilities.ts',
    search: 'resume: false,',
    replacement: 'resume: true,',
    test: 'test/chat.capabilities.contract.spec.ts',
  },
];

function replaceExactlyOnce(source, search, replacement, name) {
  const first = source.indexOf(search);
  if (first === -1) {
    throw new Error(`Mutation source not found for: ${name}`);
  }
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Mutation source is not unique for: ${name}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

for (const mutant of mutants) {
  const original = readFileSync(mutant.file, 'utf8');
  const mutated = replaceExactlyOnce(
    original,
    mutant.search,
    mutant.replacement,
    mutant.name,
  );

  writeFileSync(mutant.file, mutated);
  try {
    const result = spawnSync(
      'npx',
      ['jest', '--runInBand', '--runTestsByPath', mutant.test],
      {
        encoding: 'utf8',
        env: { ...process.env, CI: 'true' },
      },
    );

    if (result.error) throw result.error;
    if (result.status === 0) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      throw new Error(`SURVIVED mutant: ${mutant.name}`);
    }

    console.log(`KILLED: ${mutant.name}`);
  } finally {
    writeFileSync(mutant.file, original);
  }
}

console.log(`Killed ${mutants.length}/${mutants.length} targeted Chat mutants.`);

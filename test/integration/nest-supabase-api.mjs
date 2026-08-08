import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const apiUrl = process.env.NEST_API_URL || 'http://127.0.0.1:3100';

assert.ok(supabaseUrl, 'SUPABASE_URL is required');
assert.ok(publishableKey, 'SUPABASE_PUBLISHABLE_KEY is required');

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

const permanentClient = createClient(supabaseUrl, publishableKey, { auth: authOptions });
const anonymousClient = createClient(supabaseUrl, publishableKey, { auth: authOptions });

function failWith(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function request(path, options = {}) {
  const { token, body, headers, ...init } = options;
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { response, body: parsed };
}

function expectStatus(result, expected, context) {
  assert.equal(
    result.response.status,
    expected,
    `${context}: expected ${expected}, got ${result.response.status}: ${JSON.stringify(result.body)}`,
  );
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `nest-api-${suffix}@example.test`;
const password = 'Nest-Local-RLS-Only-123!';

console.log('Creating real Supabase principals for Nest HTTP integration...');

const { data: permanent, error: permanentError } = await permanentClient.auth.signUp({
  email,
  password,
});
failWith(permanentError, 'permanent user signUp');
assert.ok(permanent.session?.access_token);
assert.ok(permanent.user?.id);

const { data: anonymous, error: anonymousError } = await anonymousClient.auth.signInAnonymously();
failWith(anonymousError, 'anonymous user signInAnonymously');
assert.ok(anonymous.session?.access_token);
assert.ok(anonymous.user?.id);
assert.equal(anonymous.user.is_anonymous, true);

const userAId = permanent.user.id;
const userAToken = permanent.session.access_token;
const userBId = anonymous.user.id;
const userBToken = anonymous.session.access_token;

console.log('Verifying SupabaseAuthGuard at the HTTP boundary...');

let result = await request('/api/user/me');
expectStatus(result, 401, 'missing bearer token');

result = await request('/api/user/me', { token: 'not-a-real-jwt' });
expectStatus(result, 401, 'invalid bearer token');

result = await request('/api/user/me', { token: userAToken });
expectStatus(result, 200, 'permanent user /api/user/me');
assert.equal(result.body.id, userAId);
assert.equal(result.body.tier, 'user');
assert.equal(result.body.isAnonymous, false);
assert.equal(result.body.profile, null);

result = await request('/api/user/me', { token: userBToken });
expectStatus(result, 200, 'anonymous user /api/user/me');
assert.equal(result.body.id, userBId);
assert.equal(result.body.tier, 'anon');
assert.equal(result.body.isAnonymous, true);
assert.equal(result.body.profile, null);

console.log('Verifying request-scoped profile RLS through Nest...');

result = await request('/api/user/profile', {
  method: 'PATCH',
  token: userAToken,
  body: { displayName: 'Nest User A', preferences: { theme: 'dark' } },
});
expectStatus(result, 200, 'user A profile patch');
assert.equal(result.body.id, userAId);
assert.equal(result.body.display_name, 'Nest User A');
assert.deepEqual(result.body.preferences, { theme: 'dark' });

result = await request('/api/user/profile', {
  method: 'PATCH',
  token: userBToken,
  body: { displayName: 'Nest Anonymous B' },
});
expectStatus(result, 200, 'anonymous B profile patch');
assert.equal(result.body.id, userBId);

result = await request('/api/user/me', { token: userAToken });
expectStatus(result, 200, 'user A profile reload');
assert.equal(result.body.profile.display_name, 'Nest User A');

result = await request('/api/user/me', { token: userBToken });
expectStatus(result, 200, 'anonymous B profile reload');
assert.equal(result.body.profile.display_name, 'Nest Anonymous B');

console.log('Verifying Chat CRUD, cursor DTOs and cross-user isolation through Nest...');

const createdA = [];
for (const title of ['A first', 'A second']) {
  result = await request('/api/chats', {
    method: 'POST',
    token: userAToken,
    body: { title },
  });
  expectStatus(result, 201, `user A create ${title}`);
  assert.equal(result.body.user_id, userAId);
  createdA.push(result.body);
}

result = await request('/api/chats', {
  method: 'POST',
  token: userBToken,
  body: { title: 'B private' },
});
expectStatus(result, 201, 'anonymous B create chat');
assert.equal(result.body.user_id, userBId);
const chatB = result.body;

result = await request('/api/chats?limit=1', { token: userAToken });
expectStatus(result, 200, 'user A first chat page');
assert.equal(result.body.chats.length, 1);
assert.equal(result.body.chats[0].user_id, userAId);
assert.ok(result.body.nextCursor, 'user A first page should expose a cursor');
const cursor = result.body.nextCursor;
const firstPageId = result.body.chats[0].id;

result = await request(`/api/chats?limit=1&after=${encodeURIComponent(cursor)}`, {
  token: userAToken,
});
expectStatus(result, 200, 'user A second chat page');
assert.equal(result.body.chats.length, 1);
assert.equal(result.body.chats[0].user_id, userAId);
assert.notEqual(result.body.chats[0].id, firstPageId);
assert.deepEqual(
  new Set([firstPageId, result.body.chats[0].id]),
  new Set(createdA.map((chat) => chat.id)),
  'two cursor pages should cover A own chats without duplication',
);

result = await request('/api/chats', { token: userBToken });
expectStatus(result, 200, 'anonymous B chat list');
assert.deepEqual(result.body.chats.map((chat) => chat.id), [chatB.id]);

const chatA = createdA[0];

result = await request(`/api/chats/${chatA.id}`, { token: userBToken });
expectStatus(result, 404, 'B cannot load A chat');

result = await request(`/api/chats/${chatA.id}`, {
  method: 'PATCH',
  token: userBToken,
  body: { title: 'must not update' },
});
expectStatus(result, 404, 'B cannot patch A chat');

result = await request(`/api/chats/${chatA.id}/messages`, { token: userBToken });
expectStatus(result, 404, 'B cannot list A messages');

// DELETE intentionally remains idempotent/opaque: RLS makes a foreign row look
// like zero affected rows, so the controller returns 204. Prove it did not delete A.
result = await request(`/api/chats/${chatA.id}`, {
  method: 'DELETE',
  token: userBToken,
});
expectStatus(result, 204, 'B foreign delete remains opaque');

result = await request(`/api/chats/${chatA.id}`, { token: userAToken });
expectStatus(result, 200, 'A chat survives B delete attempt');
assert.equal(result.body.chat.id, chatA.id);

result = await request(`/api/chats/${chatA.id}`, {
  method: 'PATCH',
  token: userAToken,
  body: { title: 'A updated' },
});
expectStatus(result, 200, 'A patches own chat');
assert.equal(result.body.title, 'A updated');

result = await request('/api/chats?limit=1&unexpected=1', { token: userAToken });
expectStatus(result, 400, 'unknown query field rejected by global validation');

result = await request(`/api/chats/${chatA.id}`, {
  method: 'DELETE',
  token: userAToken,
});
expectStatus(result, 204, 'A deletes own chat');

result = await request(`/api/chats/${chatA.id}`, { token: userAToken });
expectStatus(result, 404, 'deleted A chat is gone');

result = await request(`/api/chats/${chatB.id}`, { token: userBToken });
expectStatus(result, 200, 'B chat remains after A delete');
assert.equal(result.body.chat.id, chatB.id);

console.log('Nest Guard + Auth getUser + request-scoped Supabase client + RLS integration passed.');

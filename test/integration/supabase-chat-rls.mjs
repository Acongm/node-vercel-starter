import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url, 'SUPABASE_URL is required');
assert.ok(publishableKey, 'SUPABASE_PUBLISHABLE_KEY is required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

const userA = createClient(url, publishableKey, { auth: authOptions });
const anonymousB = createClient(url, publishableKey, { auth: authOptions });
const admin = createClient(url, serviceRoleKey, { auth: authOptions });

function failWith(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message} (${error.code ?? 'no-code'})`);
  }
}

async function expectRlsDenied(promise, context) {
  const { data, error } = await promise;
  assert.ok(error, `${context}: expected an RLS error, got data=${JSON.stringify(data)}`);
  assert.match(
    `${error.code ?? ''} ${error.message ?? ''}`,
    /(42501|row-level security|violates row-level security)/i,
    `${context}: unexpected error ${error.code ?? ''} ${error.message ?? ''}`,
  );
}

async function rawOwnChats(accessToken) {
  const response = await fetch(
    `${url}/rest/v1/chats?select=id,user_id,title&order=updated_at.desc,id.desc`,
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );
  assert.equal(response.status, 200, `raw PostgREST chat list failed: ${await response.text()}`);
  return response.json();
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `chat-rls-${suffix}@example.test`;
const password = 'Local-Chat-RLS-Only-123!';

console.log('Creating one permanent Supabase user and one anonymous Supabase user...');

const { data: signUpData, error: signUpError } = await userA.auth.signUp({
  email,
  password,
});
failWith(signUpError, 'user A signUp');
assert.ok(signUpData.session?.access_token, 'user A should receive a real access token');
assert.ok(signUpData.user?.id, 'user A should have a real auth.users id');
assert.equal(Boolean(signUpData.user?.is_anonymous), false, 'user A must be permanent');

const { data: anonData, error: anonError } = await anonymousB.auth.signInAnonymously();
failWith(anonError, 'anonymous B signInAnonymously');
assert.ok(anonData.session?.access_token, 'anonymous B should receive a real access token');
assert.ok(anonData.user?.id, 'anonymous B should have a real auth.users id');
assert.equal(anonData.user?.is_anonymous, true, 'user B must be a Supabase anonymous user');
assert.notEqual(signUpData.user.id, anonData.user.id, 'test principals must have distinct auth.uid values');

const userAId = signUpData.user.id;
const userAToken = signUpData.session.access_token;
const userBId = anonData.user.id;
const userBToken = anonData.session.access_token;

const { data: verifiedA, error: verifyAError } = await userA.auth.getUser(userAToken);
failWith(verifyAError, 'Auth getUser A');
assert.equal(verifiedA.user.id, userAId, 'Auth server must validate user A token');

const { data: verifiedB, error: verifyBError } = await anonymousB.auth.getUser(userBToken);
failWith(verifyBError, 'Auth getUser anonymous B');
assert.equal(verifiedB.user.id, userBId, 'Auth server must validate anonymous B token');
assert.equal(verifiedB.user.is_anonymous, true, 'Auth server must preserve anonymous identity flag');

console.log('Verifying user-scoped profile writes...');

let result = await userA
  .from('profiles')
  .insert({ id: userAId, display_name: 'User A' })
  .select('id,display_name')
  .single();
failWith(result.error, 'user A profile insert');
assert.equal(result.data.id, userAId);

result = await anonymousB
  .from('profiles')
  .insert({ id: userBId, display_name: 'Anonymous B' })
  .select('id,display_name')
  .single();
failWith(result.error, 'anonymous B profile insert');
assert.equal(result.data.id, userBId);

await expectRlsDenied(
  anonymousB.from('profiles').insert({ id: userAId, display_name: 'stolen' }),
  'anonymous B inserting user A profile',
);

console.log('Creating one chat per principal through PostgREST...');

const { data: chatA, error: chatAError } = await userA
  .from('chats')
  .insert({ user_id: userAId, title: 'A private chat' })
  .select('id,user_id,title')
  .single();
failWith(chatAError, 'user A chat insert');

const { data: chatB, error: chatBError } = await anonymousB
  .from('chats')
  .insert({ user_id: userBId, title: 'B anonymous private chat' })
  .select('id,user_id,title')
  .single();
failWith(chatBError, 'anonymous B chat insert');

const rawAChats = await rawOwnChats(userAToken);
assert.deepEqual(rawAChats.map((row) => row.id), [chatA.id], 'raw JWT/PostgREST A must see only A chat');

const rawBChats = await rawOwnChats(userBToken);
assert.deepEqual(rawBChats.map((row) => row.id), [chatB.id], 'raw JWT/PostgREST anonymous B must see only B chat');

const { data: bReadsA, error: bReadsAError } = await anonymousB
  .from('chats')
  .select('id')
  .eq('id', chatA.id);
failWith(bReadsAError, 'B filtered read of A chat');
assert.deepEqual(bReadsA, [], 'RLS must hide A chat from B');

const { data: bUpdatesA, error: bUpdatesAError } = await anonymousB
  .from('chats')
  .update({ title: 'must not change' })
  .eq('id', chatA.id)
  .select('id');
failWith(bUpdatesAError, 'B filtered update of A chat');
assert.deepEqual(bUpdatesA, [], 'RLS must make foreign update affect no rows');

const { data: bDeletesA, error: bDeletesAError } = await anonymousB
  .from('chats')
  .delete()
  .eq('id', chatA.id)
  .select('id');
failWith(bDeletesAError, 'B filtered delete of A chat');
assert.deepEqual(bDeletesA, [], 'RLS must make foreign delete affect no rows');

await expectRlsDenied(
  anonymousB.from('chats').insert({ user_id: userAId, title: 'cross-user owner' }),
  'anonymous B inserting a chat owned by A',
);

console.log('Verifying message parent ownership and durable run ownership...');

const { data: messageA, error: messageAError } = await userA
  .from('messages')
  .insert({
    chat_id: chatA.id,
    user_id: userAId,
    client_message_id: 'user-a-1',
    role: 'user',
    parts: [{ type: 'text', text: 'hello from A' }],
  })
  .select('id,chat_id,user_id,client_message_id')
  .single();
failWith(messageAError, 'user A message insert');

const { data: messageB, error: messageBError } = await anonymousB
  .from('messages')
  .insert({
    chat_id: chatB.id,
    user_id: userBId,
    client_message_id: 'user-b-1',
    role: 'user',
    parts: [{ type: 'text', text: 'hello from anonymous B' }],
  })
  .select('id,chat_id,user_id')
  .single();
failWith(messageBError, 'anonymous B message insert');

await expectRlsDenied(
  anonymousB.from('messages').insert({
    chat_id: chatA.id,
    user_id: userBId,
    client_message_id: 'b-cross-a-chat',
    role: 'user',
    parts: [{ type: 'text', text: 'must fail' }],
  }),
  'anonymous B inserting message into A chat',
);

await expectRlsDenied(
  anonymousB.from('messages').insert({
    chat_id: chatB.id,
    user_id: userAId,
    client_message_id: 'b-forges-a-owner',
    role: 'user',
    parts: [{ type: 'text', text: 'must fail' }],
  }),
  'anonymous B forging user A message owner',
);

const { data: runA, error: runAError } = await userA
  .from('chat_runs')
  .insert({
    chat_id: chatA.id,
    user_id: userAId,
    user_message_id: messageA.id,
    status: 'running',
  })
  .select('id,chat_id,user_id,user_message_id,status')
  .single();
failWith(runAError, 'user A run insert');
assert.equal(runA.user_message_id, messageA.id);

await expectRlsDenied(
  anonymousB.from('chat_runs').insert({
    chat_id: chatA.id,
    user_id: userBId,
    user_message_id: messageB.id,
    status: 'running',
  }),
  'anonymous B binding a run to A chat',
);

const { data: bRuns, error: bRunsError } = await anonymousB
  .from('chat_runs')
  .select('id');
failWith(bRunsError, 'anonymous B run list');
assert.deepEqual(bRuns, [], 'anonymous B must not see A runs');

console.log('Verifying database cascade through a user-authorized chat delete...');

const { data: deletedA, error: deleteAError } = await userA
  .from('chats')
  .delete()
  .eq('id', chatA.id)
  .select('id');
failWith(deleteAError, 'user A deleting own chat');
assert.deepEqual(deletedA.map((row) => row.id), [chatA.id]);

const { data: remainingAMessages, error: adminMessagesError } = await admin
  .from('messages')
  .select('id')
  .eq('chat_id', chatA.id);
failWith(adminMessagesError, 'service-role cascade message verification');
assert.deepEqual(remainingAMessages, [], 'deleting A chat must cascade A messages');

const { data: remainingARuns, error: adminRunsError } = await admin
  .from('chat_runs')
  .select('id')
  .eq('chat_id', chatA.id);
failWith(adminRunsError, 'service-role cascade run verification');
assert.deepEqual(remainingARuns, [], 'deleting A chat must cascade A runs');

const { data: bChatStillExists, error: bStillError } = await anonymousB
  .from('chats')
  .select('id')
  .eq('id', chatB.id);
failWith(bStillError, 'anonymous B chat after A delete');
assert.deepEqual(bChatStillExists.map((row) => row.id), [chatB.id], 'A delete must not affect B chat');

console.log('Supabase Auth + JWT + PostgREST + RLS integration passed.');

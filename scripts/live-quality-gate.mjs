/**
 * Live #37 JWT smoke against api.acongm.com.
 *
 * Uses ACONGM_SUPABASE_ACCESS_TOKEN (Supabase Management API) to mint an
 * ephemeral confirmed user, then probes session / user / chats with a real
 * access token. Always deletes the user (and created chat) afterwards.
 *
 * Exit codes: 0 success, 2 skipped (no secret), 1 failure.
 */
const MANAGEMENT_TOKEN = process.env.ACONGM_SUPABASE_ACCESS_TOKEN?.trim();
const PROJECT_REF = 'ejprvntpxlyydkzsjqnv';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const API_BASE = process.env.LIVE_API_BASE?.trim() || 'https://api.acongm.com';
const USER_AGENT = 'acongm-live-quality-gate/1.0';

function skip(message) {
  console.log(JSON.stringify({ skipped: true, reason: message }));
  process.exit(2);
}

function fail(message, extra) {
  console.error(JSON.stringify({ ok: false, error: message, ...extra }));
  process.exit(1);
}

async function request(url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { 'User-Agent': USER_AGENT, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json, text };
}

function requireJson(result, label) {
  if (!result.json || typeof result.json !== 'object') {
    fail(`${label} did not return JSON`, { status: result.status });
  }
  return result.json;
}

async function loadProjectKeys() {
  const result = await request(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`,
    { headers: { Authorization: `Bearer ${MANAGEMENT_TOKEN}`, Accept: 'application/json' } },
  );
  const keys = requireJson(result, 'management api-keys');
  if (!Array.isArray(keys)) {
    fail('management api-keys response was not a list', { status: result.status });
  }
  const serviceRole = keys.find((key) => key.name === 'service_role')?.api_key;
  const anon = keys.find((key) => key.name === 'anon')?.api_key;
  if (!serviceRole || !anon) {
    fail('management api-keys missing service_role or anon');
  }
  return { serviceRole, anon };
}

function adminHeaders(serviceRole) {
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    'Content-Type': 'application/json',
  };
}

async function createEphemeralUser(serviceRole) {
  const stamp = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const email = `qg-${stamp}@acongm.com`;
  const password = `Qg-${crypto.randomUUID().slice(0, 18)}!`;
  const result = await request(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(serviceRole),
    body: { email, password, email_confirm: true },
  });
  const user = requireJson(result, 'admin create user');
  if (result.status >= 300 || !user.id) {
    fail('failed to create ephemeral user', { status: result.status, code: user.code });
  }
  return { id: user.id, email, password };
}

async function passwordLogin(anon, email, password) {
  const result = await request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: { email, password },
  });
  const session = requireJson(result, 'password login');
  if (!session.access_token) {
    fail('password login did not return access_token', { status: result.status });
  }
  return session.access_token;
}

async function deleteUser(serviceRole, userId) {
  const result = await request(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(serviceRole),
  });
  if (result.status >= 300) {
    fail('failed to delete ephemeral user', { status: result.status });
  }
}

async function main() {
  if (!MANAGEMENT_TOKEN) {
    skip('ACONGM_SUPABASE_ACCESS_TOKEN is not set');
  }

  const { serviceRole, anon } = await loadProjectKeys();
  const user = await createEphemeralUser(serviceRole);
  let chatId = null;

  try {
    const accessToken = await passwordLogin(anon, user.email, user.password);
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    const session = requireJson(
      await request(`${API_BASE}/api/auth/session`, { headers: authHeaders }),
      'session',
    );
    if (session.authenticated !== true || session.isAnonymous !== false) {
      fail('session was not an authenticated permanent user', {
        authenticated: session.authenticated,
        isAnonymous: session.isAnonymous,
      });
    }
    if (session.userInfo?.id !== user.id) {
      fail('session userInfo.id did not match ephemeral user');
    }

    const info = requireJson(
      await request(`${API_BASE}/api/user/info`, { headers: authHeaders }),
      'user info',
    );
    if (info.userInfo?.id !== user.id || info.userInfo?.isAnonymous !== false) {
      fail('user info did not match ephemeral user');
    }

    const list = requireJson(
      await request(`${API_BASE}/api/chats`, { headers: authHeaders }),
      'chats list',
    );
    if (!Array.isArray(list.chats)) {
      fail('chats list missing chats array');
    }

    const created = requireJson(
      await request(`${API_BASE}/api/chats`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: {
          title: 'quality-gate-live',
          pagePath: '/',
          moduleKey: '_general',
        },
      }),
      'create chat',
    );
    if (!created.id) {
      fail('create chat did not return id');
    }
    chatId = created.id;

    if (chatId) {
      const deleted = await request(`${API_BASE}/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (deleted.status >= 300) {
        fail('failed to delete live chat', { status: deleted.status });
      }
    }

    console.log(
      JSON.stringify({
        ok: true,
        apiBase: API_BASE,
        session: { authenticated: true, isAnonymous: false },
        userInfo: { role: info.userInfo?.role, tier: info.userInfo?.tier },
        chats: { listed: list.chats.length, created: true, deleted: true },
      }),
    );
  } finally {
    await deleteUser(serviceRole, user.id);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'live quality gate failed');
});

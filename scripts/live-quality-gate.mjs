/**
 * Live #37 JWT smoke against api.acongm.com.
 *
 * Uses ACONGM_SUPABASE_ACCESS_TOKEN (Supabase Management API) to mint an
 * ephemeral confirmed user, then probes session / user / chats with a real
 * access token. Always deletes the user (and created chat) afterwards.
 *
 * Exit codes: 0 success, 2 skipped (no secret), 1 failure.
 */
import {
  mintLiveUser,
  request,
} from './lib/ephemeral-supabase-user.mjs';

const MANAGEMENT_TOKEN = process.env.ACONGM_SUPABASE_ACCESS_TOKEN?.trim();
const API_BASE = process.env.LIVE_API_BASE?.trim() || 'https://api.acongm.com';

function skip(message) {
  console.log(JSON.stringify({ skipped: true, reason: message }));
  process.exit(2);
}

function fail(message, extra) {
  console.error(JSON.stringify({ ok: false, error: message, ...extra }));
  process.exit(1);
}

function requireJson(result, label) {
  if (!result.json || typeof result.json !== 'object') {
    fail(`${label} did not return JSON`, { status: result.status });
  }
  return result.json;
}

async function main() {
  if (!MANAGEMENT_TOKEN) {
    skip('ACONGM_SUPABASE_ACCESS_TOKEN is not set');
  }

  const live = await mintLiveUser(MANAGEMENT_TOKEN);
  let chatId = null;

  try {
    const authHeaders = {
      Authorization: `Bearer ${live.session.access_token}`,
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
    if (session.userInfo?.id !== live.user.id) {
      fail('session userInfo.id did not match ephemeral user');
    }

    const info = requireJson(
      await request(`${API_BASE}/api/user/info`, { headers: authHeaders }),
      'user info',
    );
    if (info.userInfo?.id !== live.user.id || info.userInfo?.isAnonymous !== false) {
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

    const deleted = await request(`${API_BASE}/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (deleted.status >= 300) {
      fail('failed to delete live chat', { status: deleted.status });
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
    await live.cleanup();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'live quality gate failed');
});

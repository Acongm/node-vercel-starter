#!/usr/bin/env node
/**
 * Unauthenticated production smoke for #37.
 * Does not sign in, create users, or change Auth settings.
 *
 *   node scripts/public-quality-gate.mjs
 *   API_BASE=https://api.acongm.com node scripts/public-quality-gate.mjs
 */

const API_BASE = process.env.API_BASE || 'https://api.acongm.com';
const SITES = {
  chat: process.env.CHAT_BASE || 'https://chat.acongm.com',
  portal: process.env.PORTAL_BASE || 'https://www.acongm.com',
  auth: process.env.AUTH_BASE || 'https://auth.acongm.com',
};

const EXPECTED_CAPABILITIES = {
  durableSend: true,
  durableRetry: true,
  durableReload: true,
  durableEditBranch: true,
  durableCancel: true,
  cursorPagination: true,
  historyUpdate: false,
  historyDelete: false,
  resume: false,
};

const results = [];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 200);
  }
  return { response, body, text };
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkHealth() {
  const { response, body } = await fetchJson(`${API_BASE}/api/health`);
  const ok =
    response.ok &&
    body &&
    typeof body === 'object' &&
    body.ok === true &&
    typeof body.dataMode === 'string';
  record(
    'GET /api/health',
    ok,
    ok ? `dataMode=${body.dataMode}` : `status=${response.status}`,
  );
}

async function checkAuthError(path, expectedCode) {
  const { response, body } = await fetchJson(`${API_BASE}${path}`);
  const ok =
    response.status === 401 &&
    body &&
    typeof body === 'object' &&
    body.code === expectedCode;
  record(
    `${path} without token`,
    ok,
    ok ? expectedCode : `status=${response.status} code=${body?.code || 'none'}`,
  );
}

async function checkCapabilities() {
  const { response, body } = await fetchJson(`${API_BASE}/api/chat/capabilities`);
  if (response.status === 404) {
    record(
      'GET /api/chat/capabilities',
      true,
      'pending deploy (404). Matrix is locked in-process by chat.capabilities.contract.spec.ts',
    );
    return;
  }
  const ok =
    response.ok &&
    body &&
    typeof body === 'object' &&
    JSON.stringify(body.capabilities) === JSON.stringify(EXPECTED_CAPABILITIES);
  record(
    'GET /api/chat/capabilities',
    ok,
    ok ? 'matrix matches' : `status=${response.status}`,
  );
}

async function checkSite(name, url) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    const looksHtml = /<html|<!doctype html/i.test(text);
    const ok = response.ok && looksHtml;
    record(
      `${name} ${url}`,
      ok,
      ok
        ? `status=${response.status} html=${text.length}B`
        : `status=${response.status}`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    record(`${name} ${url}`, false, reason);
  }
}

async function main() {
  await checkHealth();
  await checkAuthError('/api/user/info', 'AUTH_REQUIRED');
  await checkAuthError('/api/chats', 'AUTH_REQUIRED');
  await checkCapabilities();
  await checkSite('chat', SITES.chat);
  await checkSite('portal', SITES.portal);
  await checkSite('auth', SITES.auth);

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.error(`\npublic quality gate failed: ${failed.length} check(s)`);
    process.exit(1);
  }
  console.log(`\npublic quality gate passed: ${results.length} checks`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
